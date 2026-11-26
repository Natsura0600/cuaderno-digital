"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db, ESTADOS_SOLICITUD, type EstadoSolicitud } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, todosLosUsuarios } from "@/lib/alcance";
import { hoy } from "@/lib/fechas";
import { ESTADO_SOL } from "@/lib/matricula";
import { notificar } from "@/lib/notificar";
import type { Resultado } from "@/components/formularios";

export async function cambiarEstado(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const estado = String(fd.get("estado")) as EstadoSolicitud;
  if (!ESTADOS_SOLICITUD.includes(estado)) return { ok: false, msg: "Estado inválido." };
  const s = await db.solicitudes.actualizar(id, { estado, observaciones: String(fd.get("observaciones") ?? "").trim() || null });
  if (s?.padreId) await notificar([s.padreId], { titulo: `Matrícula ${s.cicloLectivo}: ${ESTADO_SOL[estado].texto}`, cuerpo: `${s.alumnoNombre} ${s.alumnoApellido}. ${ESTADO_SOL[estado].ayuda}`, link: "/matricula", tipo: "matricula" });
  revalidatePath("/matricula");
  return { ok: true, msg: s?.padreId ? "Estado actualizado. Se avisó a la familia." : `Estado actualizado. La familia lo ve con su código ${s?.codigo}.` };
}

/** Da de alta al alumno aceptado: lo asigna a un curso y crea la cuenta de la familia. */
export async function darDeAlta(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const s = await db.solicitudes.uno(id);
  const cursoId = Number(fd.get("curso"));
  if (!s || s.estado !== "aceptada" || s.alumnoId) return { ok: false, msg: "La solicitud tiene que estar aceptada y sin alta previa." };
  if (!(await db.cursos.uno(cursoId))) return { ok: false, msg: "Elegí el curso." };
  let msgClave = "";
  let padreId = s.padreId ?? (await db.idPorEmail(s.tutorEmail));
  if (!padreId) {
    const clave = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
    const [nombre, ...ap] = s.tutorNombre.split(" ");
    const u = await db.usuarios.insertar({ nombre, apellido: ap.join(" ") || s.alumnoApellido, email: s.tutorEmail, passwordHash: await bcrypt.hash(clave, 10), rol: "padre", telefono: s.tutorTelefono, cargo: null, activo: true, creado: new Date().toISOString() });
    await db.indexarEmail(s.tutorEmail, u.id);
    padreId = u.id;
    msgClave = ` Cuenta de la familia: ${s.tutorEmail} · contraseña inicial «${clave}» (pasásela y pediles que la cambien).`;
  }
  const codigoQr = `CD-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const a = await db.alumnos.insertar({ nombre: s.alumnoNombre, apellido: s.alumnoApellido, dni: s.alumnoDni, fechaNac: s.alumnoFechaNac, cursoId, codigoQr, activo: true });
  await db.indexarQr(codigoQr, a.id);
  await db.familias.insertar({ padreId, alumnoId: a.id, vinculo: "Responsable" });
  await db.solicitudes.actualizar(id, { alumnoId: a.id, padreId });
  revalidatePath("/matricula");
  return { ok: true, msg: `${a.nombre} ${a.apellido} quedó inscripto.${msgClave}` };
}

export async function reinscribir(alumnoId: number) {
  const u = await requerir("padre");
  const h = (await hijosDe(u.id)).find((x) => x.id === alumnoId);
  if (!h) return;
  const ciclo = Number(hoy().slice(0, 4)) + 1;
  if ((await db.solicitudes.todos((s) => s.alumnoId === alumnoId && s.cicloLectivo === ciclo)).length) return;
  const curso = await db.cursos.uno(h.cursoId);
  const yo = await db.usuarios.uno(u.id);
  const codigo = `R${ciclo}-${alumnoId}`;
  const s = await db.solicitudes.insertar({
    codigo, tipo: "reinscripcion", padreId: u.id, alumnoId, alumnoNombre: h.nombre, alumnoApellido: h.apellido, alumnoDni: h.dni, alumnoFechaNac: h.fechaNac,
    nivel: h.nivel, anio: (curso?.anio ?? 0) + 1, cicloLectivo: ciclo, tutorNombre: `${u.nombre} ${u.apellido}`, tutorEmail: u.email, tutorTelefono: yo?.telefono ?? "",
    escuelaAnterior: null, comentarios: null, estado: "recibida", observaciones: null, documentos: [], creado: new Date().toISOString(),
  });
  await db.indexarSolicitud(codigo, s.id);
  const dirs = (await todosLosUsuarios()).filter((x) => x.rol === "directivo").map((x) => x.id);
  await notificar(dirs, { titulo: "Nueva reinscripción", cuerpo: `${h.nombre} ${h.apellido} → ${(curso?.anio ?? 0) + 1}° año`, link: "/matricula", tipo: "matricula" });
  revalidatePath("/matricula");
}
