"use server";

import { revalidatePath } from "next/cache";
import { claveNota, db, type Calificacion } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, puedeEditarMateria } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { hoy } from "@/lib/fechas";
import { fmtNota, promedioTrimestre } from "@/lib/notas";
import { notificarFamilias } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function guardarNotas(materiaId: number, trimestre: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo");
  if (!(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "No podés editar esta materia." };
  const m = await db.materias.uno(materiaId);
  if (!m || ![1, 2, 3].includes(trimestre)) return { ok: false, msg: "Datos inválidos." };
  const crs = await db.criterios.todos((c) => c.materiaId === materiaId);
  const als = await alumnosDeCursos([m.cursoId]);
  let cambios = 0;
  const errores: string[] = [];
  const nuevasAlertas: { id: number; nombre: string; prom: number }[] = [];
  for (const a of als) {
    const actuales = await db.notas.todos(a.id);
    const antes = promedioTrimestre(crs.flatMap((c) => (actuales[claveNota(c.id, trimestre)] ? [{ ...actuales[claveNota(c.id, trimestre)], peso: c.peso }] : [])), trimestre);
    const guardar: Record<string, Calificacion> = {};
    const borrar: string[] = [];
    for (const c of crs) {
      const k = claveNota(c.id, trimestre);
      const raw = String(fd.get(`n-${a.id}-${c.id}`) ?? "").trim().replace(",", ".");
      if (raw === "") {
        if (actuales[k]) borrar.push(k);
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 10) {
        errores.push(`${a.apellido}: "${raw}" no es una nota entre 1 y 10`);
        continue;
      }
      const nota = Math.round(n * 100) / 100;
      if (actuales[k]?.nota !== nota) guardar[k] = { criterioId: c.id, trimestre, nota, fecha: hoy() };
    }
    if (Object.keys(guardar).length) await db.notas.guardar(a.id, guardar);
    if (borrar.length) await db.notas.borrar(a.id, borrar);
    cambios += Object.keys(guardar).length + borrar.length;
    const despues = { ...actuales, ...guardar };
    for (const k of borrar) delete despues[k];
    const prom = promedioTrimestre(crs.flatMap((c) => (despues[claveNota(c.id, trimestre)] ? [{ ...despues[claveNota(c.id, trimestre)], peso: c.peso }] : [])), trimestre);
    if (prom !== null && prom < REGLAS.notaAprobacion && (antes === null || antes >= REGLAS.notaAprobacion)) nuevasAlertas.push({ id: a.id, nombre: a.nombre, prom });
  }
  await Promise.all(
    nuevasAlertas.map((x) =>
      notificarFamilias(x.id, {
        titulo: `Aviso temprano: ${m.nombre}`,
        cuerpo: `${x.nombre} tiene promedio ${fmtNota(x.prom)} en el ${trimestre}° trimestre. Te sugerimos pedir una reunión con el docente.`,
        link: "/calificaciones",
        tipo: "notas",
      }),
    ),
  );
  revalidatePath(`/calificaciones/${materiaId}`);
  if (errores.length) return { ok: false, msg: `Se guardaron ${cambios} cambios, pero revisá: ${errores.slice(0, 3).join("; ")}.` };
  return { ok: true, msg: `Guardado: ${cambios} nota${cambios === 1 ? "" : "s"}.${nuevasAlertas.length ? ` Se avisó a ${nuevasAlertas.length} familia${nuevasAlertas.length > 1 ? "s" : ""} por promedio bajo.` : ""}` };
}

export async function agregarCriterio(materiaId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo");
  if (!(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "No podés editar esta materia." };
  const nombre = String(fd.get("nombre") ?? "").trim();
  const peso = Number(fd.get("peso"));
  if (!nombre) return { ok: false, msg: "Poné un nombre para el criterio." };
  if (!Number.isInteger(peso) || peso < 1 || peso > 5) return { ok: false, msg: "El peso va de 1 a 5." };
  await db.criterios.insertar({ materiaId, nombre, peso });
  revalidatePath(`/calificaciones/${materiaId}`);
  return { ok: true, msg: `Criterio «${nombre}» agregado.` };
}

export async function quitarCriterio(materiaId: number, criterioId: number) {
  const u = await requerir("profesor", "directivo");
  if (!(await puedeEditarMateria(u, materiaId))) return;
  const c = await db.criterios.uno(criterioId);
  if (c?.materiaId !== materiaId) return;
  const m = await db.materias.uno(materiaId);
  const als = await alumnosDeCursos([m!.cursoId]);
  await Promise.all(als.map((a) => db.notas.borrar(a.id, [1, 2, 3].map((t) => claveNota(criterioId, t)))));
  await db.criterios.borrar(criterioId);
  revalidatePath(`/calificaciones/${materiaId}`);
}
