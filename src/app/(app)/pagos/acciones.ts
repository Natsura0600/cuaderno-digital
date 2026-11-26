"use server";

import { revalidatePath } from "next/cache";
import { claveCuota, db, type Cuota } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, todosLosAlumnos, todosLosUsuarios } from "@/lib/alcance";
import { hoy, mesNombre, pesos } from "@/lib/fechas";
import { notificar, padresDe } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function generarCuotas(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const periodo = String(fd.get("periodo") ?? "");
  const concepto = String(fd.get("concepto") ?? "").trim() || "Cuota mensual";
  const monto = Math.round(Number(fd.get("monto")));
  const vencimiento = String(fd.get("vencimiento") ?? "");
  if (!/^\d{4}-\d{2}$/.test(periodo) || !/^\d{4}-\d{2}-\d{2}$/.test(vencimiento)) return { ok: false, msg: "Completá el mes y el vencimiento." };
  if (!(monto > 0)) return { ok: false, msg: "El monto tiene que ser mayor a cero." };
  const [als, becas] = await Promise.all([todosLosAlumnos(), db.becas.todos((b) => b.vigente)]);
  let creadas = 0;
  for (const a of als) {
    const k = claveCuota(periodo, concepto);
    if (await db.cuotas.campo(a.id, k)) continue;
    const pct = becas.filter((b) => b.alumnoId === a.id).reduce((s, b) => Math.max(s, b.porcentaje), 0);
    const descuento = concepto === "Cuota mensual" ? Math.round((monto * pct) / 100) : 0;
    await db.cuotas.guardar(a.id, { [k]: { alumnoId: a.id, periodo, concepto, montoBase: monto, descuento, vencimiento, pagada: descuento >= monto ? new Date().toISOString() : null, medio: descuento >= monto ? "Beca" : null } });
    creadas++;
  }
  revalidatePath("/pagos");
  return { ok: true, msg: `Se generaron ${creadas} cuotas de ${mesNombre(periodo)}${als.length - creadas ? ` (${als.length - creadas} ya existían)` : ""}.` };
}

export async function registrarPago(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const alumnoId = Number(fd.get("alumno"));
  const claves = fd.getAll("cuota").map(String);
  const medio = String(fd.get("medio") ?? "Efectivo en secretaría");
  if (!claves.length) return { ok: false, msg: "Elegí al menos una cuota." };
  const cs = await db.cuotas.todos(alumnoId);
  const cambios: Record<string, Cuota> = {};
  for (const k of claves) if (cs[k] && !cs[k].pagada) cambios[k] = { ...cs[k], pagada: new Date().toISOString(), medio };
  await db.cuotas.guardar(alumnoId, cambios);
  const total = Object.values(cambios).reduce((s, c) => s + c.montoBase - c.descuento, 0);
  const a = await db.alumnos.uno(alumnoId);
  const padres = await padresDe([alumnoId]);
  await notificar(padres.map((p) => p.padreId), { titulo: "Pago registrado", cuerpo: `${pesos(total)} · ${a?.nombre}. ¡Gracias!`, link: "/pagos", tipo: "pago" });
  revalidatePath("/pagos");
  return { ok: true, msg: `Pago de ${pesos(total)} registrado (${Object.keys(cambios).length} cuota${Object.keys(cambios).length > 1 ? "s" : ""}).` };
}

export async function recordarDeuda(alumnoIds: number[]) {
  await requerir("directivo");
  for (const id of alumnoIds) {
    const vencidas = (await db.cuotas.lista(id)).filter((c) => !c.pagada && c.vencimiento < hoy());
    if (!vencidas.length) continue;
    const a = await db.alumnos.uno(id);
    const total = vencidas.reduce((s, c) => s + c.montoBase - c.descuento, 0);
    const padres = await padresDe([id]);
    await notificar(padres.map((p) => p.padreId), { titulo: `Recordatorio de pago: ${a?.nombre}`, cuerpo: `Hay ${vencidas.length} cuota${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} por ${pesos(total)}.`, link: "/pagos", tipo: "pago" });
  }
  revalidatePath("/pagos");
}

export async function avisarPago(alumnoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("padre");
  const h = (await hijosDe(u.id)).find((x) => x.id === alumnoId);
  if (!h) return { ok: false, msg: "Alumno no válido." };
  const detalle = String(fd.get("detalle") ?? "").trim().slice(0, 200);
  if (!detalle) return { ok: false, msg: "Contanos cuándo y cómo pagaste (por ejemplo, número de operación)." };
  const dirs = (await todosLosUsuarios()).filter((x) => x.rol === "directivo").map((x) => x.id);
  await notificar(dirs, { titulo: `Aviso de pago: ${h.nombre} ${h.apellido}`, cuerpo: `${u.nombre} ${u.apellido}: ${detalle}`, link: `/pagos?alumno=${alumnoId}`, tipo: "pago" });
  return { ok: true, msg: "Le avisamos a administración. Cuando lo acrediten vas a ver la cuota como pagada." };
}

export async function guardarBeca(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const alumnoId = Number(fd.get("alumno"));
  const porcentaje = Number(fd.get("porcentaje"));
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!(await db.alumnos.uno(alumnoId))) return { ok: false, msg: "Elegí un alumno." };
  if (!(porcentaje > 0 && porcentaje <= 100) || !motivo) return { ok: false, msg: "Indicá porcentaje (1 a 100) y motivo." };
  await db.becas.insertar({ alumnoId, porcentaje, motivo, vigente: true });
  revalidatePath("/pagos");
  return { ok: true, msg: "Beca registrada. Se aplica a las próximas cuotas que generes." };
}

export async function quitarBeca(id: number) {
  await requerir("directivo");
  await db.becas.actualizar(id, { vigente: false });
  revalidatePath("/pagos");
}
