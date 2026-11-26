import "server-only";
import { db, type Materia } from "@/db";

/** Planes sugeridos para arrancar rápido (se pueden editar después). Horas semanales en módulos. */
export const PLANES: { id: string; nombre: string; materias: [string, string, number][] }[] = [
  {
    id: "sec-basico-1",
    nombre: "Secundaria · 1° año (ciclo básico)",
    materias: [
      ["Prácticas del Lenguaje", "Lengua", 4], ["Matemática", "Matemática", 4], ["Ciencias Naturales", "Ciencias Naturales", 4],
      ["Ciencias Sociales", "Ciencias Sociales", 4], ["Inglés", "Lenguas extranjeras", 2], ["Construcción de Ciudadanía", "Ciencias Sociales", 2],
      ["Educación Artística", "Artes", 2], ["Educación Física", "Educación Física", 2],
    ],
  },
  {
    id: "sec-basico-23",
    nombre: "Secundaria · 2° y 3° año (ciclo básico)",
    materias: [
      ["Prácticas del Lenguaje", "Lengua", 4], ["Matemática", "Matemática", 4], ["Biología", "Ciencias Naturales", 2],
      ["Físico-Química", "Ciencias Naturales", 2], ["Historia", "Ciencias Sociales", 2], ["Geografía", "Ciencias Sociales", 2],
      ["Inglés", "Lenguas extranjeras", 2], ["Construcción de Ciudadanía", "Ciencias Sociales", 2], ["Educación Artística", "Artes", 2],
      ["Educación Física", "Educación Física", 2],
    ],
  },
  {
    id: "sec-superior",
    nombre: "Secundaria · 4° a 6° año (ciclo superior, base común)",
    materias: [
      ["Literatura", "Lengua", 3], ["Matemática", "Matemática", 3], ["Inglés", "Lenguas extranjeras", 2], ["Historia", "Ciencias Sociales", 2],
      ["Geografía", "Ciencias Sociales", 2], ["Biología", "Ciencias Naturales", 2], ["Salud y Adolescencia", "Ciencias Naturales", 2],
      ["Educación Física", "Educación Física", 2], ["Política y Ciudadanía", "Ciencias Sociales", 2],
    ],
  },
  {
    id: "primaria",
    nombre: "Primaria",
    materias: [
      ["Prácticas del Lenguaje", "Lengua", 6], ["Matemática", "Matemática", 6], ["Ciencias Naturales", "Ciencias Naturales", 3],
      ["Ciencias Sociales", "Ciencias Sociales", 3], ["Inglés", "Lenguas extranjeras", 2], ["Música", "Artes", 1], ["Plástica", "Artes", 1],
      ["Educación Física", "Educación Física", 2],
    ],
  },
];

const CRITERIOS_INICIALES: [string, number][] = [["Trabajos prácticos", 1], ["Evaluaciones", 2], ["Proceso y participación", 1]];

export async function crearMateria(datos: Omit<Materia, "id">) {
  const m = await db.materias.insertar(datos);
  await db.criterios.insertarVarios(CRITERIOS_INICIALES.map(([nombre, peso]) => ({ materiaId: m.id, nombre, peso })));
  if (m.profesorId) await actualizarCargoDocente(m.profesorId);
  return m;
}

/** Borra una materia y todo lo que cuelga de ella (horario, criterios, programa, planificaciones, tareas y evaluaciones). */
export async function borrarMateria(id: number) {
  const m = await db.materias.uno(id);
  if (!m) return;
  const [hs, crs, ts, ps, tars, evs] = await Promise.all([
    db.horarios.todos((h) => h.materiaId === id), db.criterios.todos((c) => c.materiaId === id), db.temas.todos((t) => t.materiaId === id),
    db.planificaciones.todos((p) => p.materiaId === id), db.tareas.todos((t) => t.materiaId === id), db.eventos.todos((e) => e.materiaId === id),
  ]);
  const hIds = new Set(hs.map((h) => h.id));
  const cobs = await db.coberturas.todos((c) => hIds.has(c.horarioId));
  await Promise.all([
    db.coberturas.borrar(cobs.map((c) => c.id)), db.horarios.borrar(hs.map((h) => h.id)), db.criterios.borrar(crs.map((c) => c.id)),
    db.temas.borrar(ts.map((t) => t.id)), db.planificaciones.borrar(ps.map((p) => p.id)), db.tareas.borrar(tars.map((t) => t.id)),
    db.eventos.borrar(evs.map((e) => e.id)),
  ]);
  await db.materias.borrar(id);
  if (m.profesorId) await actualizarCargoDocente(m.profesorId);
}

/** Mantiene el cargo de un docente ("Docente de Matemática y Física") según lo que tiene asignado. */
export async function actualizarCargoDocente(profesorId: number) {
  const u = await db.usuarios.uno(profesorId);
  if (!u || u.rol !== "profesor") return;
  if (u.cargo && !u.cargo.startsWith("Docente de")) return; // cargo escrito a mano: no se toca
  const nombres = [...new Set((await db.materias.todos((m) => m.profesorId === profesorId)).map((m) => m.nombre))];
  const cargo = nombres.length ? `Docente de ${nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0]}` : null;
  if (cargo !== u.cargo) await db.usuarios.actualizar(profesorId, { cargo });
}
