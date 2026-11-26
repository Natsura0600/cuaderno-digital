import "server-only";
import { db, type Curso, type Nivel } from "@/db";
import { borrarMateria } from "./materias";

export const NIVELES: { id: Nivel; texto: string; anios: number[] }[] = [
  { id: "inicial", texto: "Inicial", anios: [2, 3, 4, 5] },
  { id: "primaria", texto: "Primaria", anios: [1, 2, 3, 4, 5, 6] },
  { id: "secundaria", texto: "Secundaria", anios: [1, 2, 3, 4, 5, 6, 7] },
];

/** Nombre por defecto: "Sala de 4 A", "3° grado B", "1° A". */
export function nombreCurso(nivel: Nivel, anio: number, division: string) {
  const d = division.trim();
  if (nivel === "inicial") return `Sala de ${anio}${d ? ` ${d}` : ""}`;
  if (nivel === "primaria") return `${anio}° grado${d ? ` ${d}` : ""}`;
  return `${anio}°${d ? ` ${d}` : ""}`;
}

export async function crearCurso(datos: Omit<Curso, "id">) {
  const existe = (await db.cursos.todos((c) => c.nombre.toLowerCase() === datos.nombre.toLowerCase() && c.nivel === datos.nivel)).length > 0;
  if (existe) return null;
  const c = await db.cursos.insertar(datos);
  await db.aulas.insertar({ nombre: `Aula ${c.nombre}`, tipo: "aula", capacidad: 30 });
  return c;
}

/** Borra un curso sin alumnos activos, con sus materias, su aula y sus eventos. */
export async function borrarCurso(id: number) {
  const c = await db.cursos.uno(id);
  if (!c) return "El curso no existe.";
  const activos = await db.alumnos.todos((a) => a.cursoId === id && a.activo);
  if (activos.length) return `${c.nombre} tiene ${activos.length} alumnos. Pasalos a otro curso o dalos de baja antes de borrarlo.`;
  for (const m of await db.materias.todos((x) => x.cursoId === id)) await borrarMateria(m.id);
  const [aulas, evs] = await Promise.all([db.aulas.todos((a) => a.nombre === `Aula ${c.nombre}`), db.eventos.todos((e) => e.cursoId === id)]);
  await Promise.all([db.aulas.borrar(aulas.map((a) => a.id)), db.eventos.borrar(evs.map((e) => e.id))]);
  await db.cursos.borrar(id);
  return null;
}
