"use server";

import { revalidatePath } from "next/cache";
import { db, type Horario } from "@/db";
import { requerir } from "@/lib/auth";
import { REGLAS } from "@/lib/config";
import { hoy } from "@/lib/fechas";
import { generarHorario } from "@/lib/horarios";
import type { Resultado } from "@/components/formularios";

async function aulaEspecial(materiaId: number, hs: Horario[]) {
  const aulas = await db.aulas.todos();
  const usadas = hs.filter((h) => h.materiaId === materiaId).map((h) => aulas.find((a) => a.id === h.aulaId));
  return usadas.find((a) => a && a.tipo !== "aula")?.id ?? null;
}

async function aulaDelCurso(cursoId: number) {
  const [c, aulas] = await Promise.all([db.cursos.uno(cursoId), db.aulas.todos()]);
  return aulas.find((a) => a.nombre === `Aula ${c?.nombre}`)?.id ?? null;
}

/** Regenera la grilla de TODOS los cursos respetando disponibilidad, aulas especiales y superposiciones. */
export async function generarTodo(_: Resultado): Promise<Resultado> {
  await requerir("directivo");
  const [mats, hs, nd] = await Promise.all([db.materias.todos(), db.horarios.todos(), db.noDisponible.todos()]);
  const especiales = new Map(await Promise.all(mats.map(async (m) => [m.id, await aulaEspecial(m.id, hs)] as const)));
  const r = generarHorario(mats.map((m) => ({ id: m.id, cursoId: m.cursoId, profesorId: m.profesorId, horas: m.horasSemanales, aulaId: especiales.get(m.id) ?? null })), nd, { modulos: REGLAS.modulosPorDia, intentos: 120, semilla: Date.now() % 100000 });
  const aulaCurso = new Map(await Promise.all([...new Set(mats.map((m) => m.cursoId))].map(async (c) => [c, await aulaDelCurso(c)] as const)));
  // Las coberturas futuras apuntan a módulos viejos: se descartan
  const ausFut = new Set((await db.ausenciasDocentes.todos((a) => a.fecha >= hoy())).map((a) => a.id));
  await db.coberturas.borrar((await db.coberturas.todos((c) => ausFut.has(c.ausenciaId))).map((c) => c.id));
  await db.horarios.borrar(hs.map((h) => h.id));
  await db.horarios.insertarVarios(r.slots.map((s) => ({ ...s, aulaId: s.aulaId ?? aulaCurso.get(s.cursoId) ?? null })));
  revalidatePath("/horarios");
  const falt = r.sinUbicar.reduce((s, x) => s + x.horas, 0);
  return falt
    ? { ok: false, msg: `Se generó el horario, pero quedaron ${falt} horas sin lugar. Revisá la disponibilidad de los docentes o la carga horaria.` }
    : { ok: true, msg: `Horario generado: ${r.slots.length} módulos sin superposiciones.` };
}

/** Guarda la grilla editada a mano de un curso. */
export async function guardarGrilla(cursoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const [hs, mats] = await Promise.all([db.horarios.todos(), db.materias.todos((m) => m.cursoId === cursoId)]);
  const delCurso = hs.filter((h) => h.cursoId === cursoId);
  const aulaCurso = await aulaDelCurso(cursoId);
  const nuevos: Omit<Horario, "id">[] = [];
  for (let d = 1; d <= 5; d++)
    for (let mo = 1; mo <= REGLAS.modulosPorDia; mo++) {
      const v = Number(fd.get(`c-${d}-${mo}`));
      if (!v || !mats.some((m) => m.id === v)) continue;
      const previo = delCurso.find((h) => h.dia === d && h.modulo === mo && h.materiaId === v);
      nuevos.push({ cursoId, materiaId: v, dia: d, modulo: mo, aulaId: previo?.aulaId ?? (await aulaEspecial(v, hs)) ?? aulaCurso });
    }
  await db.horarios.borrar(delCurso.map((h) => h.id));
  await db.horarios.insertarVarios(nuevos);
  const conteo = mats.filter((m) => nuevos.filter((n) => n.materiaId === m.id).length !== m.horasSemanales);
  revalidatePath("/horarios");
  return conteo.length
    ? { ok: true, msg: `Guardado. Ojo: ${conteo.map((m) => `${m.nombre} tiene ${nuevos.filter((n) => n.materiaId === m.id).length} de ${m.horasSemanales} horas`).join("; ")}.` }
    : { ok: true, msg: "Guardado. La carga horaria de cada materia está completa." };
}

export async function guardarDisponibilidad(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor");
  const actuales = await db.noDisponible.todos((n) => n.profesorId === u.id);
  await db.noDisponible.borrar(actuales.map((n) => n.id));
  const nuevos = [];
  for (let d = 1; d <= 5; d++) for (let mo = 1; mo <= REGLAS.modulosPorDia; mo++) if (fd.get(`nd-${d}-${mo}`)) nuevos.push({ profesorId: u.id, dia: d, modulo: mo });
  await db.noDisponible.insertarVarios(nuevos);
  revalidatePath("/horarios");
  return { ok: true, msg: nuevos.length ? `Guardado: ${nuevos.length} módulos marcados como no disponibles. Dirección los tendrá en cuenta al armar el horario.` : "Guardado: estás disponible en todos los módulos." };
}
