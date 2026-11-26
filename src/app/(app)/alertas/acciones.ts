"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { puedeVerAlumno } from "@/lib/alcance";
import { notificarFamilias } from "@/lib/notificar";

export async function citarFamilia(alumnoId: number) {
  const u = await requerir("preceptor", "directivo");
  if (!(await puedeVerAlumno(u, alumnoId))) return;
  const a = await db.alumnos.uno(alumnoId);
  await notificarFamilias(alumnoId, {
    titulo: `El colegio quiere reunirse con ustedes por ${a?.nombre}`,
    cuerpo: `${u.nombre} ${u.apellido} (${u.cargo ?? "colegio"}) les pide coordinar una entrevista. Reservá un horario desde Reuniones.`,
    link: "/reuniones",
    tipo: "reunion",
  });
  await db.convivencia.insertar({
    alumnoId, tipo: "incidente", categoria: "Otro", gravedad: "leve", descripcion: "Citación a la familia por alerta temprana (asistencia, notas o convivencia).",
    estado: "en_seguimiento", visibleFamilia: false, autorId: u.id, fecha: new Date().toISOString().slice(0, 10),
  });
  revalidatePath("/alertas");
}
