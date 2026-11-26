"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type Comunicado } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe } from "@/lib/alcance";
import { comunicadosParaPadre } from "@/lib/consultas";
import { destinatarios } from "@/lib/destinatarios";
import { notificar } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function publicar(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const titulo = String(fd.get("titulo") ?? "").trim();
  const cuerpo = String(fd.get("cuerpo") ?? "").trim();
  const destino = String(fd.get("destino") ?? "") as Comunicado["destino"];
  const tipo = String(fd.get("tipo") ?? "informativo") as Comunicado["tipo"];
  if (!titulo || !cuerpo) return { ok: false, msg: "Completá el título y el mensaje." };
  if (!["informativo", "firma", "autorizacion"].includes(tipo)) return { ok: false, msg: "Tipo inválido." };
  let cursoId: number | null = null;
  let nivel: string | null = null;
  if (destino === "curso") {
    cursoId = Number(fd.get("curso"));
    if (!(await cursosDe(u)).some((c) => c.id === cursoId)) return { ok: false, msg: "Elegí uno de tus cursos." };
  } else if (destino === "nivel") {
    if (u.rol !== "directivo") return { ok: false, msg: "Solo dirección envía comunicados a todo un nivel." };
    nivel = String(fd.get("nivel") ?? "secundaria");
  } else if (destino === "todos") {
    if (u.rol !== "directivo") return { ok: false, msg: "Solo dirección envía comunicados a todo el colegio." };
  } else return { ok: false, msg: "Elegí a quién va dirigido." };
  const c = await db.comunicados.insertar({ titulo, cuerpo, autorId: u.id, destino, nivel, cursoId, tipo, creado: new Date().toISOString() });
  const dest = await destinatarios(c);
  await notificar([...dest.keys()], {
    titulo: tipo === "informativo" ? `Nuevo comunicado: ${titulo}` : `Para firmar: ${titulo}`,
    cuerpo: cuerpo.slice(0, 140),
    link: `/comunicados/${c.id}`,
    tipo: "comunicado",
  });
  revalidatePath("/comunicados");
  redirect(`/comunicados/${c.id}?enviado=${dest.size}`);
}

export async function firmar(comunicadoId: number, respuesta: "autorizo" | "no_autorizo" | null) {
  const u = await requerir("padre");
  const c = (await comunicadosParaPadre(u.id)).find((x) => x.id === comunicadoId);
  if (!c || c.tipo === "informativo") return;
  const ahora = new Date().toISOString();
  await db.lecturas.guardar(comunicadoId, {
    [u.id]: { padreId: u.id, leido: c.lectura?.leido ?? ahora, firmado: ahora, respuesta: c.tipo === "autorizacion" ? respuesta : null },
  });
  revalidatePath(`/comunicados/${comunicadoId}`);
}

export async function recordar(comunicadoId: number) {
  const u = await requerir("profesor", "preceptor", "directivo");
  const c = await db.comunicados.uno(comunicadoId);
  if (!c || (c.autorId !== u.id && u.rol !== "directivo")) return;
  const [dest, lect] = await Promise.all([destinatarios(c), db.lecturas.todos(comunicadoId)]);
  const faltan = [...dest.keys()].filter((p) => !lect[p] || (c.tipo !== "informativo" && !lect[p].firmado));
  await notificar(faltan, { titulo: `Recordatorio: ${c.titulo}`, cuerpo: c.tipo === "informativo" ? "Todavía no lo leíste." : "Falta tu firma.", link: `/comunicados/${c.id}`, tipo: "comunicado" });
  revalidatePath(`/comunicados/${comunicadoId}`);
}
