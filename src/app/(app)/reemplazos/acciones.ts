"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { MODULOS } from "@/lib/config";
import { esHabil, fCorta, hoy } from "@/lib/fechas";
import { modulosAfectados } from "@/lib/reemplazos";
import { notificar } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function registrarAusencia(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("preceptor", "directivo");
  const profesorId = Number(fd.get("profesor"));
  const fecha = String(fd.get("fecha") ?? "");
  const motivo = String(fd.get("motivo") ?? "").trim() || "Sin especificar";
  const p = await db.usuarios.uno(profesorId);
  if (!p || p.rol !== "profesor") return { ok: false, msg: "Elegí un docente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy() || !esHabil(fecha)) return { ok: false, msg: "Elegí un día hábil a partir de hoy." };
  if ((await db.ausenciasDocentes.todos((a) => a.profesorId === profesorId && a.fecha === fecha)).length) return { ok: false, msg: "Esa ausencia ya está registrada." };
  await db.ausenciasDocentes.insertar({ profesorId, fecha, motivo, registradoPor: u.id });
  const mods = (await modulosAfectados(fecha)).filter((m) => m.profesorId === profesorId);
  revalidatePath("/reemplazos");
  return { ok: true, msg: `Ausencia registrada: ${mods.length} módulo${mods.length === 1 ? "" : "s"} para cubrir el ${fCorta(fecha)}.` };
}

export async function asignar(ausenciaId: number, horarioId: number, reemplazanteId: number) {
  const u = await requerir("preceptor", "directivo");
  const a = await db.ausenciasDocentes.uno(ausenciaId);
  if (!a) return;
  const previa = (await db.coberturas.todos((c) => c.ausenciaId === ausenciaId && c.horarioId === horarioId))[0];
  if (previa) await db.coberturas.borrar(previa.id);
  await db.coberturas.insertar({ ausenciaId, horarioId, reemplazanteId });
  const m = (await modulosAfectados(a.fecha)).find((x) => x.horarioId === horarioId);
  if (m) {
    const c = await db.cursos.uno(m.cursoId);
    await notificar([reemplazanteId], {
      titulo: `Cubrís ${m.curso} el ${fCorta(a.fecha)}`,
      cuerpo: `${m.modulo}° módulo (${MODULOS[m.modulo - 1].desde}) · ${m.materia} de ${m.profesor}. Asignado por ${u.nombre} ${u.apellido}.`,
      link: "/reemplazos",
    });
    if (c?.preceptorId && c.preceptorId !== u.id) await notificar([c.preceptorId], { titulo: `Reemplazo asignado en ${m.curso}`, cuerpo: `${m.modulo}° módulo, ${fCorta(a.fecha)}`, link: "/reemplazos" });
  }
  revalidatePath("/reemplazos");
}

export async function quitarCobertura(id: number) {
  await requerir("preceptor", "directivo");
  await db.coberturas.borrar(id);
  revalidatePath("/reemplazos");
}

export async function borrarAusencia(id: number) {
  await requerir("preceptor", "directivo");
  const cs = await db.coberturas.todos((c) => c.ausenciaId === id);
  await db.coberturas.borrar(cs.map((c) => c.id));
  await db.ausenciasDocentes.borrar(id);
  revalidatePath("/reemplazos");
}
