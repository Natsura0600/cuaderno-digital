import "server-only";
import { kv } from "@/db";
import { db } from "@/db";
import { hijosDe } from "./alcance";
import { fCorta, hoy, mesNombre, pesos, sumarDias } from "./fechas";
import { notificar } from "./notificar";

/**
 * Recordatorios automáticos de cuotas: cuando una familia entra a la app se generan
 * (una sola vez por cuota) los avisos de "vence en pocos días" y "venció".
 * Si más adelante se suma envío por e-mail o WhatsApp, esto se puede mover a una tarea programada (Vercel Schedules).
 */
export async function recordatoriosDeCuotas(padreId: number) {
  const hijos = await hijosDe(padreId);
  const cuotas = await db.cuotas.deVarios(hijos.map((h) => h.id));
  for (const h of hijos) {
    for (const c of cuotas.get(h.id) ?? []) {
      if (c.pagada) continue;
      const tipo = c.vencimiento < hoy() ? "vencida" : c.vencimiento <= sumarDias(hoy(), 5) ? "por-vencer" : null;
      if (!tipo) continue;
      const clave = `cd:rec:${padreId}:${h.id}:${c.periodo}:${c.concepto}:${tipo}`;
      if (await kv.get(clave)) continue;
      await kv.set(clave, "1");
      const monto = pesos(c.montoBase - c.descuento);
      await notificar([padreId], {
        titulo: tipo === "vencida" ? `Cuota vencida de ${h.nombre}` : `La cuota de ${h.nombre} vence el ${fCorta(c.vencimiento)}`,
        cuerpo: `${c.concepto} de ${mesNombre(c.periodo)}: ${monto}.`,
        link: `/pagos?hijo=${h.id}`,
        tipo: "pago",
      });
    }
  }
}
