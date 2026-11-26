"use server";

import { revalidatePath } from "next/cache";
import { db, TIPOS_EVENTO, type TipoEvento } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe, puedeEditarMateria } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { fCorta } from "@/lib/fechas";
import { notificar, padresDe } from "@/lib/notificar";
import { alumnosDeCursos } from "@/lib/alcance";
import type { Resultado } from "@/components/formularios";

export async function crearEvento(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const titulo = String(fd.get("titulo") ?? "").trim();
  const tipo = String(fd.get("tipo")) as TipoEvento;
  const fecha = String(fd.get("fecha") ?? "");
  const hora = String(fd.get("hora") ?? "") || null;
  const cursoId = Number(fd.get("curso")) || null;
  const materiaId = Number(fd.get("materia")) || null;
  if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, msg: "Completá el título y la fecha." };
  if (!TIPOS_EVENTO.includes(tipo) || tipo === "salida") return { ok: false, msg: "Elegí el tipo. Las salidas se cargan desde Salidas." };
  if (!cursoId && u.rol !== "directivo") return { ok: false, msg: "Elegí el curso. Los eventos de todo el colegio los carga dirección." };
  if (cursoId && !(await cursosDe(u)).some((c) => c.id === cursoId)) return { ok: false, msg: "Ese curso no está a tu cargo." };
  if (tipo === "feriado" && u.rol !== "directivo") return { ok: false, msg: "Los días sin clases los carga dirección." };
  if (tipo === "evaluacion") {
    if (!cursoId) return { ok: false, msg: "Una evaluación tiene que ser de un curso." };
    if (materiaId && !(await puedeEditarMateria(u, materiaId))) return { ok: false, msg: "Elegí una de tus materias." };
    const mismas = await db.eventos.todos((e) => e.tipo === "evaluacion" && e.cursoId === cursoId && e.fecha === fecha);
    if (mismas.length >= REGLAS.maxEvaluacionesPorDia)
      return { ok: false, msg: `El curso ya tiene ${mismas.length} evaluaciones el ${fCorta(fecha)} (${mismas.map((e) => e.titulo).join(" y ")}). El máximo es ${REGLAS.maxEvaluacionesPorDia} por día: elegí otra fecha.` };
  }
  await db.eventos.insertar({ titulo, tipo, fecha, hora, cursoId, materiaId, descripcion: String(fd.get("descripcion") ?? "").trim() || null, autorId: u.id });
  if (fd.get("avisar") === "on") {
    const als = cursoId ? await alumnosDeCursos([cursoId]) : await alumnosDeCursos((await db.cursos.todos()).map((c) => c.id));
    const padres = await padresDe(als.map((a) => a.id));
    await notificar(padres.map((p) => p.padreId), { titulo: `${titulo} · ${fCorta(fecha)}`, cuerpo: hora ? `${hora} h` : undefined, link: "/calendario", tipo: "calendario" });
  }
  revalidatePath("/calendario");
  return { ok: true, msg: "Agregado al calendario." };
}

export async function borrarEvento(id: number) {
  const u = await requerir("profesor", "preceptor", "directivo");
  const e = await db.eventos.uno(id);
  if (!e || (e.autorId !== u.id && u.rol !== "directivo") || e.tipo === "salida") return;
  await db.eventos.borrar(id);
  revalidatePath("/calendario");
}
