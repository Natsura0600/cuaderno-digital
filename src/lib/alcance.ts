import "server-only";
import { cache } from "react";
import { db, type Alumno, type Curso } from "@/db";
import type { Usuario } from "./auth";

export type { Alumno, Curso };

const ordenCursos = (a: Curso, b: Curso) => a.nivel.localeCompare(b.nivel) || a.anio - b.anio || a.division.localeCompare(b.division);
const ordenAlumnos = (a: Alumno, b: Alumno) => a.apellido.localeCompare(b.apellido, "es") || a.nombre.localeCompare(b.nombre, "es");

export const todosLosCursos = cache(async () => (await db.cursos.todos()).sort(ordenCursos));
export const todosLosAlumnos = cache(async () => (await db.alumnos.todos((a) => a.activo)).sort(ordenAlumnos));
export const todasLasMaterias = cache(() => db.materias.todos());
export const todosLosUsuarios = cache(() => db.usuarios.todos());

/** Cursos que la persona puede ver según su rol. */
export const cursosDe = cache(async (u: Usuario): Promise<Curso[]> => {
  const cs = await todosLosCursos();
  if (u.rol === "directivo") return cs;
  if (u.rol === "preceptor") return cs.filter((c) => c.preceptorId === u.id);
  if (u.rol === "profesor") {
    const ids = new Set((await todasLasMaterias()).filter((m) => m.profesorId === u.id).map((m) => m.cursoId));
    return cs.filter((c) => ids.has(c.id));
  }
  const ids = new Set((await hijosDe(u.id)).map((h) => h.cursoId));
  return cs.filter((c) => ids.has(c.id));
});

export const hijosDe = cache(async (padreId: number) => {
  const fams = await db.familias.todos((f) => f.padreId === padreId);
  const [als, cs] = await Promise.all([db.alumnos.varios(fams.map((f) => f.alumnoId)), todosLosCursos()]);
  return als
    .filter((a) => a.activo)
    .map((a) => {
      const c = cs.find((x) => x.id === a.cursoId)!;
      return { ...a, curso: c.nombre, nivel: c.nivel };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
});

export async function alumnosDeCursos(cursoIds: number[]) {
  const ids = new Set(cursoIds);
  return (await todosLosAlumnos()).filter((a) => ids.has(a.cursoId));
}

/** ¿Puede esta persona ver los datos de este alumno? */
export async function puedeVerAlumno(u: Usuario, alumnoId: number): Promise<boolean> {
  if (u.rol === "directivo") return true;
  if (u.rol === "padre") return (await hijosDe(u.id)).some((h) => h.id === alumnoId);
  const a = await db.alumnos.uno(alumnoId);
  if (!a) return false;
  return (await cursosDe(u)).some((c) => c.id === a.cursoId);
}

export async function puedeVerCurso(u: Usuario, cursoId: number) {
  return (await cursosDe(u)).some((c) => c.id === cursoId);
}

export type MateriaVista = { id: number; nombre: string; area: string; cursoId: number; curso: string; nivel: string; anio: number; profesorId: number | null; horasSemanales: number };

/** Materias visibles: las propias para docentes, las de sus cursos para preceptores, todas para directivos. */
export async function materiasDe(u: Usuario): Promise<MateriaVista[]> {
  const [ms, cs] = await Promise.all([todasLasMaterias(), todosLosCursos()]);
  const misCursos = u.rol === "preceptor" || u.rol === "padre" ? new Set((await cursosDe(u)).map((c) => c.id)) : null;
  return ms
    .filter((m) => (u.rol === "profesor" ? m.profesorId === u.id : misCursos ? misCursos.has(m.cursoId) : true))
    .map((m) => {
      const c = cs.find((x) => x.id === m.cursoId)!;
      return { ...m, curso: c.nombre, nivel: c.nivel, anio: c.anio };
    })
    .sort((a, b) => a.anio - b.anio || a.curso.localeCompare(b.curso) || a.nombre.localeCompare(b.nombre));
}

export async function puedeEditarMateria(u: Usuario, materiaId: number) {
  if (u.rol === "directivo") return true;
  if (u.rol !== "profesor") return false;
  return (await db.materias.uno(materiaId))?.profesorId === u.id;
}

export function nombreCompleto(x: { nombre: string; apellido: string } | null | undefined) {
  return x ? `${x.nombre} ${x.apellido}` : "—";
}
