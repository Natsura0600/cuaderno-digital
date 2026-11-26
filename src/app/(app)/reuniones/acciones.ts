"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe } from "@/lib/alcance";
import { aDate, fFechaHora, hoy } from "@/lib/fechas";
import { notificar } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function publicarTurnos(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const fecha = String(fd.get("fecha") ?? "");
  const desde = String(fd.get("desde") ?? "");
  const cantidad = Number(fd.get("cantidad"));
  const minutos = Number(fd.get("minutos"));
  const modalidad = fd.get("modalidad") === "virtual" ? "virtual" : "presencial";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy()) return { ok: false, msg: "Elegí una fecha a partir de hoy." };
  if (!/^\d{2}:\d{2}$/.test(desde)) return { ok: false, msg: "Indicá la hora de inicio." };
  if (!(cantidad >= 1 && cantidad <= 12) || ![15, 20, 30, 45].includes(minutos)) return { ok: false, msg: "Revisá la cantidad y la duración." };
  const inicio = aDate(fecha, desde).getTime();
  const existentes = await db.turnos.todos((t) => t.docenteId === u.id && !t.cancelado);
  const nuevos = [];
  for (let i = 0; i < cantidad; i++) {
    const t = new Date(inicio + i * minutos * 60000);
    if (existentes.some((e) => Math.abs(new Date(e.inicio).getTime() - t.getTime()) < minutos * 60000)) continue;
    nuevos.push({ docenteId: u.id, inicio: t.toISOString(), minutos, modalidad: modalidad as "presencial" | "virtual", padreId: null, alumnoId: null, motivo: null, cancelado: false });
  }
  await db.turnos.insertarVarios(nuevos);
  revalidatePath("/reuniones");
  return { ok: true, msg: `Publicaste ${nuevos.length} horario${nuevos.length === 1 ? "" : "s"}.${nuevos.length < cantidad ? " Algunos se superponían con otros y no se crearon." : ""}` };
}

export async function reservar(turnoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("padre");
  const alumnoId = Number(fd.get("alumno"));
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!(await hijosDe(u.id)).some((h) => h.id === alumnoId)) return { ok: false, msg: "Elegí a tu hijo o hija." };
  if (!motivo) return { ok: false, msg: "Contanos brevemente el motivo." };
  const t = await db.turnos.uno(turnoId);
  if (!t || t.cancelado || t.padreId || t.inicio < new Date().toISOString()) return { ok: false, msg: "Ese horario ya no está disponible." };
  await db.turnos.actualizar(turnoId, { padreId: u.id, alumnoId, motivo });
  const a = await db.alumnos.uno(alumnoId);
  await notificar([t.docenteId], { titulo: `Reunión reservada: ${a?.nombre} ${a?.apellido}`, cuerpo: `${fFechaHora(new Date(t.inicio))} · ${motivo}`, link: "/reuniones", tipo: "reunion" });
  revalidatePath("/reuniones");
  return { ok: true, msg: `Reservado para el ${fFechaHora(new Date(t.inicio))}.` };
}

export async function cancelar(turnoId: number) {
  const u = await requerir();
  const t = await db.turnos.uno(turnoId);
  if (!t) return;
  if (u.rol === "padre" && t.padreId === u.id) {
    await db.turnos.actualizar(turnoId, { padreId: null, alumnoId: null, motivo: null });
    await notificar([t.docenteId], { titulo: "Una familia canceló su reunión", cuerpo: fFechaHora(new Date(t.inicio)), link: "/reuniones" });
  } else if (t.docenteId === u.id) {
    if (t.padreId) await notificar([t.padreId], { titulo: "Se canceló tu reunión", cuerpo: `${u.nombre} ${u.apellido} canceló la reunión del ${fFechaHora(new Date(t.inicio))}. Podés reservar otro horario.`, link: "/reuniones", tipo: "reunion" });
    await db.turnos.actualizar(turnoId, { cancelado: true });
  }
  revalidatePath("/reuniones");
}
