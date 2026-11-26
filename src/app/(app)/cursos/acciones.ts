"use server";

import { revalidatePath } from "next/cache";
import { db, type Nivel } from "@/db";
import { requerir } from "@/lib/auth";
import { borrarCurso, crearCurso, NIVELES, nombreCurso } from "@/lib/cursos";
import type { Resultado } from "@/components/formularios";

async function preceptorValido(v: FormDataEntryValue | null) {
  const id = Number(v);
  if (!id) return null;
  const u = await db.usuarios.uno(id);
  return u?.rol === "preceptor" && u.activo ? id : null;
}

/** Crea uno o varios cursos: por ejemplo, de 1° a 6° con divisiones A y B. */
export async function crearCursos(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const nivel = String(fd.get("nivel")) as Nivel;
  const nv = NIVELES.find((n) => n.id === nivel);
  if (!nv) return { ok: false, msg: "Elegí el nivel." };
  const desde = Number(fd.get("desde"));
  const hasta = Number(fd.get("hasta") || desde);
  const divisiones = String(fd.get("divisiones") ?? "").split(/[,\s;/]+/).map((d) => d.trim().toUpperCase()).filter(Boolean);
  const nombrePropio = String(fd.get("nombre") ?? "").trim();
  if (!nv.anios.includes(desde) || !nv.anios.includes(hasta) || hasta < desde) return { ok: false, msg: "Revisá los años." };
  if (nombrePropio && (hasta !== desde || divisiones.length > 1)) return { ok: false, msg: "El nombre propio es para crear un solo curso." };
  const turno = fd.get("turno") === "tarde" ? "tarde" : "mañana";
  const preceptorId = await preceptorValido(fd.get("preceptor"));
  const creados: string[] = [];
  const repetidos: string[] = [];
  for (let anio = desde; anio <= hasta; anio++)
    for (const division of divisiones.length ? divisiones : [""]) {
      const nombre = nombrePropio || nombreCurso(nivel, anio, division);
      const c = await crearCurso({ nombre, nivel, anio, division, turno, preceptorId });
      (c ? creados : repetidos).push(nombre);
    }
  revalidatePath("/cursos");
  if (!creados.length) return { ok: false, msg: `Ya existían: ${repetidos.join(", ")}.` };
  return { ok: true, msg: `Creados: ${creados.join(", ")}.${repetidos.length ? ` Ya existían: ${repetidos.join(", ")}.` : ""} Siguiente paso: cargarles las materias.` };
}

export async function editarCurso(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const c = await db.cursos.uno(id);
  if (!c) return { ok: false, msg: "El curso no existe." };
  const nombre = String(fd.get("nombre") ?? "").trim() || c.nombre;
  const division = String(fd.get("division") ?? "").trim().toUpperCase();
  const otro = (await db.cursos.todos((x) => x.id !== id && x.nivel === c.nivel && x.nombre.toLowerCase() === nombre.toLowerCase())).length;
  if (otro) return { ok: false, msg: `Ya hay otro curso llamado ${nombre}.` };
  await db.cursos.actualizar(id, { nombre, division, turno: fd.get("turno") === "tarde" ? "tarde" : "mañana", preceptorId: await preceptorValido(fd.get("preceptor")) });
  if (nombre !== c.nombre) {
    const aula = (await db.aulas.todos((a) => a.nombre === `Aula ${c.nombre}`))[0];
    if (aula) await db.aulas.actualizar(aula.id, { nombre: `Aula ${nombre}` });
  }
  revalidatePath("/cursos");
  return { ok: true, msg: `${nombre} guardado.` };
}

export async function eliminarCurso(id: number, _: Resultado): Promise<Resultado> {
  await requerir("directivo");
  const error = await borrarCurso(id);
  revalidatePath("/cursos");
  return error ? { ok: false, msg: error } : { ok: true, msg: "Curso borrado." };
}
