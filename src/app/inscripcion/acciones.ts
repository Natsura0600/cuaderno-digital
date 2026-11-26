"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { guardarArchivo } from "@/lib/archivos";
import { todosLosUsuarios } from "@/lib/alcance";
import { DOCUMENTOS } from "@/lib/matricula";
import { notificar } from "@/lib/notificar";
import { hoy } from "@/lib/fechas";

export async function solicitar(_: { error: string } | null, fd: FormData): Promise<{ error: string } | null> {
  if (String(fd.get("sitio_web") ?? "")) return { error: "No se pudo enviar." }; // trampa para bots
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const datos = {
    alumnoNombre: v("alumnoNombre"), alumnoApellido: v("alumnoApellido"), alumnoDni: v("alumnoDni").replace(/\D/g, ""), alumnoFechaNac: v("alumnoFechaNac") || null,
    nivel: v("nivel") || "secundaria", anio: Number(v("anio")), tutorNombre: v("tutorNombre"), tutorEmail: v("tutorEmail").toLowerCase(), tutorTelefono: v("tutorTelefono"),
    escuelaAnterior: v("escuelaAnterior") || null, comentarios: v("comentarios").slice(0, 1500) || null,
  };
  if (!datos.alumnoNombre || !datos.alumnoApellido || !datos.tutorNombre) return { error: "Completá los nombres del alumno y del adulto responsable." };
  if (!/^\d{7,9}$/.test(datos.alumnoDni)) return { error: "El DNI del alumno tiene que tener entre 7 y 9 números." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.tutorEmail)) return { error: "Revisá el e-mail." };
  if (datos.tutorTelefono.replace(/\D/g, "").length < 8) return { error: "Revisá el teléfono." };
  if (!(datos.anio >= 1 && datos.anio <= 7)) return { error: "Elegí el año al que ingresa." };
  const ciclo = Number(hoy().slice(0, 4)) + (Number(hoy().slice(5, 7)) >= 7 ? 1 : 0);
  if ((await db.solicitudes.todos((s) => s.alumnoDni === datos.alumnoDni && s.cicloLectivo === ciclo)).length)
    return { error: "Ya hay una solicitud para ese DNI en este ciclo. Consultá su estado con el código que recibiste." };
  const documentos: { nombre: string; archivo: string }[] = [];
  for (const d of DOCUMENTOS) {
    const f = fd.get(d.campo);
    if (f instanceof File && f.size > 0) {
      try {
        documentos.push({ nombre: d.nombre, archivo: await guardarArchivo(f, "matricula") });
      } catch (e) {
        return { error: `${d.nombre}: ${(e as Error).message}` };
      }
    }
  }
  const n = await db.siguienteId(`codigo_matricula_${ciclo}`);
  const codigo = `M${ciclo}-${100 + n + 10}`;
  const s = await db.solicitudes.insertar({
    ...datos, codigo, tipo: "nueva", padreId: null, alumnoId: null, cicloLectivo: ciclo, estado: "recibida", observaciones: null, documentos, creado: new Date().toISOString(),
  });
  await db.indexarSolicitud(codigo, s.id);
  const dirs = (await todosLosUsuarios()).filter((u) => u.rol === "directivo").map((u) => u.id);
  await notificar(dirs, { titulo: "Nueva solicitud de matrícula", cuerpo: `${datos.alumnoNombre} ${datos.alumnoApellido} — ${datos.anio}° año`, link: "/matricula", tipo: "matricula" });
  redirect(`/inscripcion/estado?codigo=${codigo}&dni=${datos.alumnoDni}&nueva=1`);
}
