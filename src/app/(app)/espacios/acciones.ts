"use server";

import { revalidatePath } from "next/cache";
import { db, type Espacio } from "@/db";
import { requerir } from "@/lib/auth";
import { REGLAS } from "@/lib/config";
import { esHabil, fCorta, hoy } from "@/lib/fechas";
import type { Resultado } from "@/components/formularios";

export async function reservar(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const espacioId = Number(fd.get("espacio"));
  const fecha = String(fd.get("fecha") ?? "");
  const desde = Number(fd.get("desde"));
  const hasta = Number(fd.get("hasta"));
  const e = await db.espacios.uno(espacioId);
  if (!e) return { ok: false, msg: "Elegí qué querés reservar." };
  if (e.estado !== "disponible") return { ok: false, msg: `${e.nombre} está ${e.estado === "en_reparacion" ? "en reparación" : "dado de baja"}.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy() || !esHabil(fecha)) return { ok: false, msg: "Elegí un día hábil a partir de hoy." };
  if (!(desde >= 1 && hasta >= desde && hasta <= REGLAS.modulosPorDia)) return { ok: false, msg: "Revisá los módulos." };
  const superpuestas = await db.reservas.todos((r) => r.espacioId === espacioId && r.fecha === fecha && r.moduloDesde <= hasta && r.moduloHasta >= desde);
  if (superpuestas.length >= e.cantidad) {
    const quien = await db.usuarios.varios(superpuestas.map((r) => r.usuarioId));
    return { ok: false, msg: `${e.nombre} ya está reservado el ${fCorta(fecha)} en esos módulos (${quien.map((x) => `${x.nombre} ${x.apellido}`).join(", ")}).` };
  }
  await db.reservas.insertar({ espacioId, usuarioId: u.id, fecha, moduloDesde: desde, moduloHasta: hasta, motivo: String(fd.get("motivo") ?? "").trim() || null });
  revalidatePath("/espacios");
  return { ok: true, msg: `Reservado: ${e.nombre}, ${fCorta(fecha)}, módulo${desde === hasta ? ` ${desde}°` : `s ${desde}° a ${hasta}°`}.` };
}

export async function cancelarReserva(id: number) {
  const u = await requerir("profesor", "preceptor", "directivo");
  const r = await db.reservas.uno(id);
  if (!r || (r.usuarioId !== u.id && u.rol !== "directivo")) return;
  await db.reservas.borrar(id);
  revalidatePath("/espacios");
}

export async function agregarItem(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const nombre = String(fd.get("nombre") ?? "").trim();
  const tipo = fd.get("tipo") === "espacio" ? "espacio" : "equipo";
  const cantidad = Math.max(1, Number(fd.get("cantidad")) || 1);
  if (!nombre) return { ok: false, msg: "Poné un nombre." };
  await db.espacios.insertar({ nombre, tipo, categoria: String(fd.get("categoria") ?? "").trim() || "General", cantidad, ubicacion: String(fd.get("ubicacion") ?? "").trim() || null, estado: "disponible" });
  revalidatePath("/espacios");
  return { ok: true, msg: `${nombre} agregado al inventario.` };
}

export async function cambiarEstadoItem(id: number, estado: Espacio["estado"]) {
  await requerir("directivo");
  await db.espacios.actualizar(id, { estado });
  revalidatePath("/espacios");
}
