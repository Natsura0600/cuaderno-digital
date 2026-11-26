"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type Autorizacion } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe } from "@/lib/alcance";
import { fCorta, hoy } from "@/lib/fechas";
import { notificar, padresDe } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function crearSalida(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const titulo = String(fd.get("titulo") ?? "").trim();
  const destino = String(fd.get("destino") ?? "").trim();
  const fecha = String(fd.get("fecha") ?? "");
  const horaSalida = String(fd.get("horaSalida") ?? "");
  const horaRegreso = String(fd.get("horaRegreso") ?? "");
  const cursoId = Number(fd.get("curso"));
  const costo = Math.max(0, Math.round(Number(fd.get("costo")) || 0));
  const responsables = [...new Set([u.id, ...fd.getAll("responsables").map(Number).filter(Boolean)])];
  if (!titulo || !destino) return { ok: false, msg: "Completá el lugar y el destino." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha <= hoy()) return { ok: false, msg: "La salida tiene que ser a partir de mañana." };
  if (!horaSalida || !horaRegreso || horaRegreso <= horaSalida) return { ok: false, msg: "Revisá los horarios de salida y regreso." };
  if (!(await cursosDe(u)).some((c) => c.id === cursoId)) return { ok: false, msg: "Elegí uno de tus cursos." };
  const descripcion = String(fd.get("descripcion") ?? "").trim() || null;
  const ev = await db.eventos.insertar({ titulo: `Salida: ${titulo}`, tipo: "salida", fecha, hora: horaSalida, cursoId, materiaId: null, descripcion, autorId: u.id });
  const s = await db.salidas.insertar({ titulo, destino, fecha, horaSalida, horaRegreso, cursoId, costo, descripcion, eventoId: ev.id, autorId: u.id, responsables });
  const als = await alumnosDeCursos([cursoId]);
  await db.autorizaciones.guardar(s.id, Object.fromEntries(als.map((a) => [a.id, { alumnoId: a.id, padreId: null, autorizado: null, firmado: null, pagado: costo === 0 } satisfies Autorizacion])));
  const padres = await padresDe(als.map((a) => a.id));
  await notificar(padres.map((p) => p.padreId), { titulo: `Autorización: salida a ${titulo}`, cuerpo: `${fCorta(fecha)}, de ${horaSalida} a ${horaRegreso}.`, link: `/salidas/${s.id}`, tipo: "autorizacion" });
  await notificar(responsables.filter((r) => r !== u.id), { titulo: `Sos responsable de una salida`, cuerpo: `${titulo} · ${fCorta(fecha)}`, link: `/salidas/${s.id}` });
  revalidatePath("/salidas");
  redirect(`/salidas/${s.id}`);
}

export async function responder(salidaId: number, alumnoId: number, autorizado: boolean) {
  const u = await requerir("padre");
  if (!(await hijosDe(u.id)).some((h) => h.id === alumnoId)) return;
  const s = await db.salidas.uno(salidaId);
  if (!s || s.fecha < hoy()) return;
  const actual = (await db.autorizaciones.campo(salidaId, String(alumnoId))) ?? { alumnoId, padreId: null, autorizado: null, firmado: null, pagado: s.costo === 0 };
  await db.autorizaciones.guardar(salidaId, { [alumnoId]: { ...actual, padreId: u.id, autorizado, firmado: new Date().toISOString() } });
  revalidatePath(`/salidas/${salidaId}`);
}

export async function marcarPago(salidaId: number, alumnoId: number, pagado: boolean) {
  const u = await requerir("preceptor", "directivo", "profesor");
  const s = await db.salidas.uno(salidaId);
  if (!s || !(u.rol === "directivo" || s.responsables.includes(u.id) || (await cursosDe(u)).some((c) => c.id === s.cursoId && u.rol === "preceptor"))) return;
  const actual = await db.autorizaciones.campo(salidaId, String(alumnoId));
  if (!actual) return;
  await db.autorizaciones.guardar(salidaId, { [alumnoId]: { ...actual, pagado } });
  revalidatePath(`/salidas/${salidaId}`);
}

export async function recordarSalida(salidaId: number) {
  const u = await requerir("preceptor", "directivo", "profesor");
  const s = await db.salidas.uno(salidaId);
  if (!s || !(u.rol === "directivo" || s.responsables.includes(u.id))) return;
  const auts = await db.autorizaciones.lista(salidaId);
  const faltan = auts.filter((a) => !a.firmado).map((a) => a.alumnoId);
  const padres = await padresDe(faltan);
  await notificar(padres.map((p) => p.padreId), { titulo: `Recordatorio: falta autorizar la salida a ${s.titulo}`, cuerpo: fCorta(s.fecha), link: `/salidas/${s.id}`, tipo: "autorizacion" });
  revalidatePath(`/salidas/${salidaId}`);
}
