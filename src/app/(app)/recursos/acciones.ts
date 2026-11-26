"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { guardarArchivo } from "@/lib/archivos";
import type { Resultado } from "@/components/formularios";

export async function subirRecurso(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "directivo", "preceptor");
  const titulo = String(fd.get("titulo") ?? "").trim();
  const tipo = String(fd.get("tipo")) as "guia" | "examen" | "presentacion" | "otro";
  const anio = Number(fd.get("anio"));
  const materia = String(fd.get("materia") ?? "").trim();
  const unidad = Number(fd.get("unidad")) || null;
  const url = String(fd.get("url") ?? "").trim();
  const archivo = fd.get("archivo");
  if (!titulo || !materia || !anio) return { ok: false, msg: "Completá título, año y materia." };
  if (!["guia", "examen", "presentacion", "otro"].includes(tipo)) return { ok: false, msg: "Elegí el tipo de recurso." };
  if (url && !/^https:\/\//.test(url)) return { ok: false, msg: "El enlace tiene que empezar con https://" };
  let ruta: string | null = null;
  let nombre: string | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    try {
      ruta = await guardarArchivo(archivo, "recursos");
      nombre = archivo.name;
    } catch (e) {
      return { ok: false, msg: (e as Error).message };
    }
  }
  if (!ruta && !url) return { ok: false, msg: "Subí un archivo o pegá un enlace (Drive, YouTube, etc.)." };
  await db.recursos.insertar({
    titulo, tipo, anio, materia, unidad, nivel: "secundaria", descripcion: String(fd.get("descripcion") ?? "").trim() || null,
    url: url || null, archivo: ruta, archivoNombre: nombre, soloDocentes: fd.get("soloDocentes") === "on", autorId: u.id, creado: new Date().toISOString(),
  });
  revalidatePath("/recursos");
  return { ok: true, msg: "Recurso publicado en el banco." };
}

export async function borrarRecurso(id: number) {
  const u = await requerir("profesor", "directivo", "preceptor");
  const r = await db.recursos.uno(id);
  if (!r || (r.autorId !== u.id && u.rol !== "directivo")) return;
  await db.recursos.borrar(id);
  revalidatePath("/recursos");
}
