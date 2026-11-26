"use server";

import { revalidatePath } from "next/cache";
import { db, ESTADOS_ASISTENCIA, type Asistencia, type EstadoAsistencia } from "@/db";
import { requerir } from "@/lib/auth";
import { puedeVerCurso } from "@/lib/alcance";
import { fCorta, hoy, esHabil } from "@/lib/fechas";
import { notificarFamilias } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

const HORA_TARDE = "07:45";

export async function guardarAsistencia(cursoId: number, fecha: string, marcas: Record<number, EstadoAsistencia>): Promise<Resultado> {
  const u = await requerir("preceptor", "directivo");
  if (!(await puedeVerCurso(u, cursoId))) return { ok: false, msg: "No tenés a cargo ese curso." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoy()) return { ok: false, msg: "La fecha no es válida." };
  if (!esHabil(fecha)) return { ok: false, msg: "Ese día no es hábil." };
  const als = await db.alumnos.varios(Object.keys(marcas).map(Number));
  const avisos: Promise<void>[] = [];
  for (const a of als) {
    if (a.cursoId !== cursoId) continue;
    const estado = marcas[a.id];
    if (!ESTADOS_ASISTENCIA.includes(estado)) continue;
    const previo = await db.asistencia.campo(a.id, fecha);
    if (previo?.estado === estado) continue;
    const reg: Asistencia = { fecha, estado, metodo: previo?.metodo ?? "manual", tomadaPor: u.id, hora: previo?.hora ?? new Date().toISOString() };
    await db.asistencia.guardar(a.id, { [fecha]: reg });
    if (estado === "ausente" || estado === "tarde")
      avisos.push(
        notificarFamilias(a.id, {
          titulo: estado === "ausente" ? `${a.nombre} no vino al colegio` : `${a.nombre} llegó tarde`,
          cuerpo: `${fCorta(fecha)}. Si fue por un motivo justificado, avisale a preceptoría.`,
          link: `/asistencia?hijo=${a.id}`,
          tipo: "asistencia",
        }),
      );
  }
  await Promise.all(avisos);
  revalidatePath("/asistencia");
  return { ok: true, msg: `Asistencia guardada. ${avisos.length ? `Se avisó a ${avisos.length} familia${avisos.length > 1 ? "s" : ""}.` : ""}` };
}

/** Registro por QR en la entrada: presente, o tarde si llega después de las 7:45. */
export async function registrarQr(codigo: string): Promise<{ ok: boolean; msg: string; nombre?: string; estado?: EstadoAsistencia }> {
  const u = await requerir("preceptor", "directivo");
  const id = await db.alumnoPorQr(codigo);
  const a = id ? await db.alumnos.uno(id) : null;
  if (!a || !a.activo) return { ok: false, msg: "Código no reconocido." };
  if (!(await puedeVerCurso(u, a.cursoId)) && u.rol !== "directivo") return { ok: false, msg: `${a.nombre} ${a.apellido} no es de tus cursos.` };
  const f = hoy();
  const previo = await db.asistencia.campo(a.id, f);
  if (previo && previo.estado !== "ausente") return { ok: true, msg: "Ya estaba registrado hoy.", nombre: `${a.nombre} ${a.apellido}`, estado: previo.estado };
  const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const estado: EstadoAsistencia = hora > HORA_TARDE ? "tarde" : "presente";
  await db.asistencia.guardar(a.id, { [f]: { fecha: f, estado, metodo: "qr", tomadaPor: u.id, hora: new Date().toISOString() } });
  if (estado === "tarde") await notificarFamilias(a.id, { titulo: `${a.nombre} llegó tarde`, cuerpo: `Ingresó a las ${hora}.`, link: `/asistencia?hijo=${a.id}`, tipo: "asistencia" });
  revalidatePath("/asistencia");
  return { ok: true, msg: estado === "tarde" ? `Llegada tarde (${hora})` : `Presente (${hora})`, nombre: `${a.nombre} ${a.apellido}`, estado };
}
