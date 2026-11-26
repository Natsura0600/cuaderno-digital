"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { puedeEditarMateria } from "@/lib/alcance";
import { lunesDe } from "@/lib/fechas";
import type { Resultado } from "@/components/formularios";

export async function guardarPlan(materiaId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo");
  if (!(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "No podés planificar esta materia." };
  const semana = String(fd.get("semana") ?? "");
  const objetivos = String(fd.get("objetivos") ?? "").trim();
  const actividades = String(fd.get("actividades") ?? "").trim();
  const temaIds = fd.getAll("temas").map(Number).filter(Boolean);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) return { ok: false, msg: "Elegí la semana." };
  if (!objetivos || !actividades) return { ok: false, msg: "Completá los objetivos y las actividades." };
  const lunes = lunesDe(semana);
  const existente = (await db.planificaciones.todos((p) => p.materiaId === materiaId && p.semana === lunes))[0];
  if (existente) await db.planificaciones.actualizar(existente.id, { objetivos, actividades, temaIds });
  else await db.planificaciones.insertar({ materiaId, semana: lunes, objetivos, actividades, temaIds, dictada: false, creado: new Date().toISOString() });
  revalidatePath("/planificacion");
  return { ok: true, msg: existente ? "Planificación actualizada." : "Planificación guardada." };
}

export async function marcarDictada(planId: number, dictada: boolean) {
  const u = await requerir("profesor", "directivo");
  const p = await db.planificaciones.uno(planId);
  if (!p || !(await puedeEditarMateria(u, p.materiaId))) return;
  await db.planificaciones.actualizar(planId, { dictada });
  revalidatePath("/planificacion");
}

export async function borrarPlan(planId: number) {
  const u = await requerir("profesor", "directivo");
  const p = await db.planificaciones.uno(planId);
  if (!p || !(await puedeEditarMateria(u, p.materiaId))) return;
  await db.planificaciones.borrar(planId);
  revalidatePath("/planificacion");
}

export async function agregarTema(materiaId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo");
  if (!(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "No podés editar este programa." };
  const unidad = Number(fd.get("unidad"));
  const titulo = String(fd.get("titulo") ?? "").trim();
  if (!titulo || !(unidad >= 1 && unidad <= 12)) return { ok: false, msg: "Indicá la unidad y el tema." };
  const ts = await db.temas.todos((t) => t.materiaId === materiaId && t.unidad === unidad);
  await db.temas.insertar({ materiaId, unidad, titulo, orden: unidad * 10 + ts.length });
  revalidatePath("/planificacion");
  return { ok: true, msg: "Tema agregado al programa." };
}
