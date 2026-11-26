import "server-only";
import { db, type Comunicado, type Evento, type Lectura } from "@/db";
import { promedioTrimestre, valorFalta } from "./notas";
import { alumnosDeCursos, hijosDe, todasLasMaterias, todosLosCursos, todosLosUsuarios, nombreCompleto } from "./alcance";

export type ResumenAsis = { faltas: number; tardes: number; ausentes: number; justificadas: number; dias: number };

/** Resumen de asistencia del año para un conjunto de alumnos. */
export async function resumenAsistencia(alumnoIds: number[]) {
  const asis = await db.asistencia.deVarios(alumnoIds);
  const out = new Map<number, ResumenAsis>();
  for (const id of alumnoIds) {
    const o: ResumenAsis = { faltas: 0, tardes: 0, ausentes: 0, justificadas: 0, dias: 0 };
    for (const r of asis.get(id) ?? []) {
      o.dias++;
      o.faltas += valorFalta(r.estado);
      if (r.estado === "tarde") o.tardes++;
      if (r.estado === "ausente") o.ausentes++;
      if (r.estado === "justificado") o.justificadas++;
    }
    out.set(id, o);
  }
  return out;
}

export type MateriaBoletin = {
  id: number; nombre: string; profesor: string;
  criterios: { id: number; nombre: string; peso: number; notas: (number | null)[] }[];
  promedios: (number | null)[];
};

/** Notas de un alumno agrupadas por materia, con promedios por trimestre. */
export async function boletin(alumnoId: number): Promise<MateriaBoletin[]> {
  const al = await db.alumnos.uno(alumnoId);
  if (!al) return [];
  const [mats, crs, notas, us] = await Promise.all([todasLasMaterias(), db.criterios.todos(), db.notas.todos(alumnoId), todosLosUsuarios()]);
  return mats
    .filter((m) => m.cursoId === al.cursoId)
    .map((m) => {
      const misCrit = crs.filter((c) => c.materiaId === m.id);
      const ns = misCrit.flatMap((c) =>
        [1, 2, 3].map((t) => notas[`${c.id}:${t}`]).filter(Boolean).map((n) => ({ ...n!, peso: c.peso })),
      );
      return {
        id: m.id,
        nombre: m.nombre,
        profesor: nombreCompleto(us.find((u) => u.id === m.profesorId)),
        criterios: misCrit.map((c) => ({ id: c.id, nombre: c.nombre, peso: c.peso, notas: [1, 2, 3].map((t) => notas[`${c.id}:${t}`]?.nota ?? null) })),
        promedios: [1, 2, 3].map((t) => promedioTrimestre(ns, t)),
      };
    });
}

/** Promedio de cada alumno en una materia y trimestre. */
export async function promediosDeMateria(materiaId: number, alumnoIds: number[]) {
  const [crs, notas] = await Promise.all([db.criterios.todos((c) => c.materiaId === materiaId), db.notas.deVarios(alumnoIds)]);
  const out = new Map<number, (number | null)[]>();
  for (const id of alumnoIds) {
    const ns = (notas.get(id) ?? []).flatMap((n) => {
      const c = crs.find((x) => x.id === n.criterioId);
      return c ? [{ ...n, peso: c.peso }] : [];
    });
    out.set(id, [1, 2, 3].map((t) => promedioTrimestre(ns, t)));
  }
  return out;
}

/** Promedio por curso y materia en un trimestre (panel directivo). */
export async function promediosPorCursoMateria(trimestre: number) {
  const [cs, mats, crs] = await Promise.all([todosLosCursos(), todasLasMaterias(), db.criterios.todos()]);
  const als = await alumnosDeCursos(cs.map((c) => c.id));
  const notas = await db.notas.deVarios(als.map((a) => a.id));
  const critPorId = new Map(crs.map((c) => [c.id, c]));
  const acc = new Map<number, { suma: number; peso: number }>();
  for (const ns of notas.values())
    for (const n of ns) {
      if (n.trimestre !== trimestre) continue;
      const c = critPorId.get(n.criterioId);
      if (!c) continue;
      const a = acc.get(c.materiaId) ?? { suma: 0, peso: 0 };
      a.suma += n.nota * c.peso;
      a.peso += c.peso;
      acc.set(c.materiaId, a);
    }
  return mats.map((m) => {
    const c = cs.find((x) => x.id === m.cursoId)!;
    const a = acc.get(m.id);
    return { cursoId: m.cursoId, curso: c.nombre, anio: c.anio, materia: m.nombre, materiaId: m.id, prom: a?.peso ? Math.round((a.suma / a.peso) * 100) / 100 : null };
  });
}

/** % de presentes (presente, tarde o justificado) desde una fecha. */
export async function porcentajeAsistencia(cursoIds: number[], desde: string) {
  const als = await alumnosDeCursos(cursoIds);
  const asis = await db.asistencia.deVarios(als.map((a) => a.id));
  let total = 0;
  let pres = 0;
  for (const rs of asis.values())
    for (const r of rs)
      if (r.fecha >= desde) {
        total++;
        if (r.estado !== "ausente") pres++;
      }
  return total ? Math.round((pres / total) * 1000) / 10 : null;
}

export type EventoVista = Evento & { curso: string | null };

/** Eventos visibles para un conjunto de cursos (incluye los de todo el colegio). */
export async function eventosEntre(cursoIds: number[] | "todos", desde: string, hasta: string): Promise<EventoVista[]> {
  const [evs, cs] = await Promise.all([db.eventos.todos((e) => e.fecha >= desde && e.fecha <= hasta), todosLosCursos()]);
  return evs
    .filter((e) => cursoIds === "todos" || e.cursoId === null || cursoIds.includes(e.cursoId))
    .map((e) => ({ ...e, curso: cs.find((c) => c.id === e.cursoId)?.nombre ?? null }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""));
}

export async function tareasDeCurso(cursoIds: number[], desde: string, hasta: string) {
  const mats = await todasLasMaterias();
  const ids = new Set(cursoIds);
  const tars = await db.tareas.todos((t) => t.fecha >= desde && t.fecha <= hasta);
  return tars
    .map((t) => {
      const m = mats.find((x) => x.id === t.materiaId);
      return m && ids.has(m.cursoId) ? { ...t, materia: m.nombre, cursoId: m.cursoId } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** ¿Este comunicado le llega a alguien con hijos en estos cursos/niveles? */
export function comunicadoAlcanza(c: Comunicado, cursoIds: number[], niveles: string[]) {
  return c.destino === "todos" || (c.destino === "curso" && c.cursoId !== null && cursoIds.includes(c.cursoId)) || (c.destino === "nivel" && niveles.includes(c.nivel ?? ""));
}

export type ComunicadoVista = Comunicado & { autor: string; autorCargo: string | null; curso: string | null; lectura: Lectura | null };

/** Comunicados que le llegan a una familia, con su estado de lectura. */
export async function comunicadosParaPadre(padreId: number): Promise<ComunicadoVista[]> {
  const hijos = await hijosDe(padreId);
  const cursoIds = hijos.map((h) => h.cursoId);
  const niveles = [...new Set(hijos.map((h) => h.nivel))];
  const [coms, us, cs] = await Promise.all([db.comunicados.todos(), todosLosUsuarios(), todosLosCursos()]);
  const mios = coms.filter((c) => comunicadoAlcanza(c, cursoIds, niveles));
  const lects = await Promise.all(mios.map((c) => db.lecturas.campo(c.id, String(padreId))));
  return mios
    .map((c, i) => {
      const a = us.find((u) => u.id === c.autorId);
      return { ...c, autor: nombreCompleto(a), autorCargo: a?.cargo ?? null, curso: cs.find((x) => x.id === c.cursoId)?.nombre ?? null, lectura: lects[i] };
    })
    .sort((a, b) => b.creado.localeCompare(a.creado));
}

export async function cuotasPendientes(alumnoIds: number[]) {
  const cs = await db.cuotas.deVarios(alumnoIds);
  return [...cs.values()].flat().filter((c) => !c.pagada).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
}
