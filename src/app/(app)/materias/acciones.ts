"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { actualizarCargoDocente, borrarMateria, crearMateria, PLANES } from "@/lib/materias";
import type { Resultado } from "@/components/formularios";

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function profesorValido(id: number) {
  if (!id) return null;
  const u = await db.usuarios.uno(id);
  return u && u.rol === "profesor" && u.activo ? id : null;
}

/** Crea una materia en uno o varios cursos a la vez. */
export async function nuevaMateria(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const nombre = texto(fd, "nombre");
  const area = texto(fd, "area") || nombre;
  const horas = Number(fd.get("horas"));
  const cursoIds = fd.getAll("cursos").map(Number).filter(Boolean);
  const profesorId = await profesorValido(Number(fd.get("profesor")));
  if (!nombre) return { ok: false, msg: "Escribí el nombre de la materia." };
  if (!(horas >= 1 && horas <= 12)) return { ok: false, msg: "Las horas semanales van de 1 a 12." };
  if (!cursoIds.length) return { ok: false, msg: "Marcá al menos un curso." };
  const existentes = await db.materias.todos((m) => cursoIds.includes(m.cursoId) && m.nombre.toLowerCase() === nombre.toLowerCase());
  const cursos = (await db.cursos.varios(cursoIds)).filter((c) => !existentes.some((m) => m.cursoId === c.id));
  for (const c of cursos) await crearMateria({ nombre, area, cursoId: c.id, profesorId, horasSemanales: horas });
  revalidatePath("/materias");
  const repetidas = existentes.length ? ` Ya existía en ${existentes.length} curso${existentes.length > 1 ? "s" : ""} y no se duplicó.` : "";
  return cursos.length ? { ok: true, msg: `${nombre} creada en ${cursos.map((c) => c.nombre).join(", ")}.${repetidas}` } : { ok: false, msg: `${nombre} ya existe en esos cursos.` };
}

/** Guarda nombre, área, docente y horas de todas las materias de un curso. */
export async function guardarCurso(cursoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const mats = await db.materias.todos((m) => m.cursoId === cursoId);
  const tocados = new Set<number>();
  let cambios = 0;
  for (const m of mats) {
    const nombre = texto(fd, `nombre-${m.id}`) || m.nombre;
    const area = texto(fd, `area-${m.id}`) || nombre;
    const horas = Math.min(12, Math.max(1, Number(fd.get(`horas-${m.id}`)) || m.horasSemanales));
    const profesorId = await profesorValido(Number(fd.get(`profesor-${m.id}`)));
    if (nombre !== m.nombre || area !== m.area || horas !== m.horasSemanales || profesorId !== m.profesorId) {
      await db.materias.actualizar(m.id, { nombre, area, horasSemanales: horas, profesorId });
      if (m.profesorId) tocados.add(m.profesorId);
      if (profesorId) tocados.add(profesorId);
      cambios++;
    }
  }
  for (const p of tocados) await actualizarCargoDocente(p);
  revalidatePath("/materias");
  return { ok: true, msg: cambios ? `Guardado: ${cambios} materia${cambios > 1 ? "s" : ""} actualizada${cambios > 1 ? "s" : ""}. Si cambiaste docentes u horas, generá de nuevo los horarios.` : "No había cambios para guardar." };
}

export async function quitarMateria(id: number) {
  await requerir("directivo");
  await borrarMateria(id);
  revalidatePath("/materias");
}

/** Copia las materias de un curso a otro (por ejemplo, de 1° A a 1° B). */
export async function copiarDeCurso(destinoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const origenId = Number(fd.get("origen"));
  const conDocentes = fd.get("conDocentes") === "on";
  if (!origenId || origenId === destinoId) return { ok: false, msg: "Elegí otro curso para copiar." };
  const [origen, destino] = await Promise.all([db.materias.todos((m) => m.cursoId === origenId), db.materias.todos((m) => m.cursoId === destinoId)]);
  const nuevas = origen.filter((o) => !destino.some((d) => d.nombre.toLowerCase() === o.nombre.toLowerCase()));
  for (const o of nuevas) await crearMateria({ nombre: o.nombre, area: o.area, cursoId: destinoId, profesorId: conDocentes ? o.profesorId : null, horasSemanales: o.horasSemanales });
  revalidatePath("/materias");
  return { ok: true, msg: nuevas.length ? `Se copiaron ${nuevas.length} materias.` : "El curso ya tenía todas esas materias." };
}

export async function aplicarPlan(cursoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const plan = PLANES.find((p) => p.id === fd.get("plan"));
  if (!plan) return { ok: false, msg: "Elegí un plan." };
  const actuales = await db.materias.todos((m) => m.cursoId === cursoId);
  const nuevas = plan.materias.filter(([n]) => !actuales.some((a) => a.nombre.toLowerCase() === n.toLowerCase()));
  for (const [nombre, area, horas] of nuevas) await crearMateria({ nombre, area, cursoId, profesorId: null, horasSemanales: horas });
  revalidatePath("/materias");
  return { ok: true, msg: `Se agregaron ${nuevas.length} materias del plan «${plan.nombre}». Ahora asigná los docentes.` };
}

/** Asigna (o quita) un docente a una materia desde la vista por docente. */
export async function asignar(materiaId: number, profesorId: number | null) {
  await requerir("directivo");
  const m = await db.materias.uno(materiaId);
  if (!m) return;
  const nuevo = profesorId ? await profesorValido(profesorId) : null;
  await db.materias.actualizar(materiaId, { profesorId: nuevo });
  if (m.profesorId) await actualizarCargoDocente(m.profesorId);
  if (nuevo) await actualizarCargoDocente(nuevo);
  revalidatePath("/materias");
}

export async function asignarDesdeDocente(profesorId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const ids = fd.getAll("materias").map(Number).filter(Boolean);
  if (!ids.length) return { ok: false, msg: "Elegí al menos una materia." };
  for (const id of ids) await asignar(id, profesorId);
  return { ok: true, msg: `Se asignaron ${ids.length} materia${ids.length > 1 ? "s" : ""}.` };
}
