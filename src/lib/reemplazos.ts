import "server-only";
import { db } from "@/db";
import { diaSemana } from "./fechas";
import { todasLasMaterias, todosLosCursos, todosLosUsuarios, nombreCompleto } from "./alcance";

export type ModuloAfectado = {
  horarioId: number; ausenciaId: number; modulo: number; cursoId: number; curso: string; materia: string; area: string;
  profesorId: number; profesor: string; reemplazanteId: number | null; reemplazante: string | null;
};

/** Módulos que quedan sin docente por las ausencias registradas para una fecha. */
export async function modulosAfectados(fecha: string): Promise<ModuloAfectado[]> {
  const aus = await db.ausenciasDocentes.todos((a) => a.fecha === fecha);
  if (!aus.length) return [];
  const d = diaSemana(fecha);
  const [hs, mats, cs, cobs, us] = await Promise.all([db.horarios.todos((h) => h.dia === d), todasLasMaterias(), todosLosCursos(), db.coberturas.todos(), todosLosUsuarios()]);
  const out: ModuloAfectado[] = [];
  for (const a of aus)
    for (const h of hs) {
      const m = mats.find((x) => x.id === h.materiaId);
      if (!m || m.profesorId !== a.profesorId) continue;
      const cob = cobs.find((c) => c.ausenciaId === a.id && c.horarioId === h.id);
      out.push({
        horarioId: h.id, ausenciaId: a.id, modulo: h.modulo, cursoId: h.cursoId, curso: cs.find((c) => c.id === h.cursoId)!.nombre,
        materia: m.nombre, area: m.area, profesorId: a.profesorId, profesor: nombreCompleto(us.find((u) => u.id === a.profesorId)),
        reemplazanteId: cob?.reemplazanteId ?? null, reemplazante: cob ? nombreCompleto(us.find((u) => u.id === cob.reemplazanteId)) : null,
      });
    }
  return out.sort((a, b) => a.modulo - b.modulo || a.curso.localeCompare(b.curso));
}

export async function modulosSinCubrir(fecha: string, cursoIds: number[] | null) {
  return (await modulosAfectados(fecha)).filter((m) => !m.reemplazanteId && (!cursoIds || cursoIds.includes(m.cursoId)));
}

export type Sugerencia = { id: number; nombre: string; rol: string; puntaje: number; motivos: string[] };

/**
 * Sugiere quién puede cubrir un módulo: docentes y preceptores libres en ese horario,
 * priorizando a quien ya conoce al curso, es del área, está en el colegio a esa hora y cubrió menos este mes.
 */
export async function sugerirReemplazos(fecha: string, modulo: ModuloAfectado): Promise<Sugerencia[]> {
  const d = diaSemana(fecha);
  const [us, hs, mats, nd, aus, cobs, ausTodas] = await Promise.all([
    todosLosUsuarios(), db.horarios.todos((h) => h.dia === d), todasLasMaterias(), db.noDisponible.todos((n) => n.dia === d),
    db.ausenciasDocentes.todos((a) => a.fecha === fecha), db.coberturas.todos(), db.ausenciasDocentes.todos((a) => a.fecha.slice(0, 7) === fecha.slice(0, 7)),
  ]);
  const ausentes = new Set(aus.map((a) => a.profesorId));
  const ausHoy = new Set(aus.map((a) => a.id));
  const ausMes = new Set(ausTodas.map((a) => a.id));
  const profDeHorario = (hId: number) => mats.find((m) => m.id === hs.find((h) => h.id === hId)?.materiaId)?.profesorId;
  const out: Sugerencia[] = [];
  for (const u of us) {
    if (!u.activo || (u.rol !== "profesor" && u.rol !== "preceptor") || ausentes.has(u.id)) continue;
    const susMods = hs.filter((h) => mats.find((m) => m.id === h.materiaId)?.profesorId === u.id);
    if (susMods.some((h) => h.modulo === modulo.modulo)) continue;
    if (nd.some((n) => n.profesorId === u.id && n.modulo === modulo.modulo)) continue;
    const cubriendo = cobs.filter((c) => c.reemplazanteId === u.id && ausHoy.has(c.ausenciaId));
    if (cubriendo.some((c) => hs.find((h) => h.id === c.horarioId)?.modulo === modulo.modulo)) continue;
    let puntaje = 0;
    const motivos: string[] = [];
    const susMaterias = mats.filter((m) => m.profesorId === u.id);
    if (susMaterias.some((m) => m.cursoId === modulo.cursoId)) {
      puntaje += 3;
      motivos.push(`Ya da clases en ${modulo.curso}`);
    }
    if (susMaterias.some((m) => m.area === modulo.area)) {
      puntaje += 2;
      motivos.push(`Misma área (${modulo.area})`);
    }
    if (susMods.some((h) => Math.abs(h.modulo - modulo.modulo) === 1)) {
      puntaje += 2;
      motivos.push("Está en el colegio a esa hora");
    } else if (susMods.length) {
      puntaje += 1;
      motivos.push("Tiene clases ese día");
    }
    if (u.rol === "preceptor") motivos.push("Preceptoría");
    const delMes = cobs.filter((c) => c.reemplazanteId === u.id && ausMes.has(c.ausenciaId)).length;
    puntaje -= delMes;
    if (delMes) motivos.push(`Cubrió ${delMes} módulo${delMes > 1 ? "s" : ""} este mes`);
    out.push({ id: u.id, nombre: nombreCompleto(u), rol: u.rol, puntaje, motivos });
    void profDeHorario;
  }
  return out.sort((a, b) => b.puntaje - a.puntaje || a.nombre.localeCompare(b.nombre)).slice(0, 5);
}
