"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, puedeEditarMateria } from "@/lib/alcance";
import { fCorta, hoy } from "@/lib/fechas";
import { notificar, padresDe } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function crearTarea(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo");
  const materiaId = Number(fd.get("materia"));
  const tipo = fd.get("tipo") === "material" ? "material" : "tarea";
  const titulo = String(fd.get("titulo") ?? "").trim();
  const fecha = String(fd.get("fecha") ?? "");
  if (!(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "Elegí una de tus materias." };
  if (!titulo) return { ok: false, msg: "Escribí la consigna o el material." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy()) return { ok: false, msg: "Elegí una fecha a partir de hoy." };
  const m = (await db.materias.uno(materiaId))!;
  await db.tareas.insertar({ materiaId, tipo, titulo, descripcion: String(fd.get("descripcion") ?? "").trim() || null, fecha, autorId: u.id });
  const als = await alumnosDeCursos([m.cursoId]);
  const padres = await padresDe(als.map((a) => a.id));
  await notificar(padres.map((p) => p.padreId), {
    titulo: tipo === "tarea" ? `${m.nombre}: tarea para el ${fCorta(fecha)}` : `${m.nombre}: traer material el ${fCorta(fecha)}`,
    cuerpo: titulo,
    link: "/agenda",
    tipo: "agenda",
  });
  revalidatePath("/agenda");
  return { ok: true, msg: "Publicado en la agenda del curso." };
}

export async function borrarTarea(id: number) {
  const u = await requerir("profesor", "directivo");
  const t = await db.tareas.uno(id);
  if (!t || (t.autorId !== u.id && u.rol !== "directivo")) return;
  await db.tareas.borrar(id);
  revalidatePath("/agenda");
}
