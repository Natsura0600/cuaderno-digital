"use server";

import { revalidatePath } from "next/cache";
import { db, type Convivencia } from "@/db";
import { requerir } from "@/lib/auth";
import { puedeVerAlumno, todosLosUsuarios } from "@/lib/alcance";
import { hoy } from "@/lib/fechas";
import { notificar, notificarFamilias } from "@/lib/notificar";
import { CATEGORIAS_INCIDENTE, CATEGORIAS_RECONOCIMIENTO } from "@/lib/protocolos";
import type { Resultado } from "@/components/formularios";

export async function registrar(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const alumnoId = Number(fd.get("alumno"));
  const categoria = String(fd.get("categoria") ?? "");
  const descripcion = String(fd.get("descripcion") ?? "").trim();
  const tipo: Convivencia["tipo"] = CATEGORIAS_RECONOCIMIENTO.includes(categoria) ? "reconocimiento" : "incidente";
  if (!(await puedeVerAlumno(u, alumnoId))) return { ok: false, msg: "Elegí un alumno de tus cursos." };
  if (tipo === "incidente" && !CATEGORIAS_INCIDENTE[categoria]) return { ok: false, msg: "Elegí una categoría." };
  if (!descripcion) return { ok: false, msg: "Describí lo que pasó." };
  const gravedad = tipo === "incidente" ? ((String(fd.get("gravedad") || "") || CATEGORIAS_INCIDENTE[categoria].gravedadSugerida) as Convivencia["gravedad"]) : null;
  const visibleFamilia = fd.get("visibleFamilia") === "on";
  const a = (await db.alumnos.uno(alumnoId))!;
  const r = await db.convivencia.insertar({
    alumnoId, tipo, categoria, gravedad, descripcion, estado: tipo === "reconocimiento" ? "cerrado" : "abierto", visibleFamilia, autorId: u.id, fecha: hoy(),
  });
  if (visibleFamilia)
    await notificarFamilias(alumnoId, {
      titulo: tipo === "reconocimiento" ? `Reconocimiento para ${a.nombre}: ${categoria}` : `Registro de convivencia: ${a.nombre}`,
      cuerpo: descripcion.slice(0, 140),
      link: "/convivencia",
      tipo: "convivencia",
    });
  if (gravedad === "grave") {
    const dirs = (await todosLosUsuarios()).filter((x) => x.rol === "directivo").map((x) => x.id);
    await notificar(dirs, { titulo: `Incidente grave: ${categoria}`, cuerpo: `${a.nombre} ${a.apellido}. Requiere intervención según protocolo.`, link: `/convivencia/${r.id}`, tipo: "convivencia" });
  }
  revalidatePath("/convivencia");
  return { ok: true, msg: tipo === "reconocimiento" ? "Reconocimiento registrado." : `Incidente registrado.${gravedad === "grave" ? " Se avisó al equipo directivo." : ""}` };
}

export async function agregarSeguimiento(registroId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerir("profesor", "preceptor", "directivo");
  const r = await db.convivencia.uno(registroId);
  if (!r || !(await puedeVerAlumno(u, r.alumnoId))) return { ok: false, msg: "No tenés acceso a este caso." };
  const nota = String(fd.get("nota") ?? "").trim();
  const paso = Number(fd.get("paso")) || null;
  const estado = String(fd.get("estado") ?? r.estado) as Convivencia["estado"];
  if (!nota) return { ok: false, msg: "Escribí qué se hizo." };
  await db.seguimientos.insertar({ registroId, autorId: u.id, nota, pasoProtocolo: paso, creado: new Date().toISOString() });
  if (["abierto", "en_seguimiento", "cerrado"].includes(estado) && estado !== r.estado) await db.convivencia.actualizar(registroId, { estado });
  else if (r.estado === "abierto") await db.convivencia.actualizar(registroId, { estado: "en_seguimiento" });
  revalidatePath(`/convivencia/${registroId}`);
  return { ok: true, msg: "Seguimiento agregado." };
}
