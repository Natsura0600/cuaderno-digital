import "server-only";
import { db, type Comunicado } from "@/db";
import { todosLosAlumnos, todosLosCursos } from "./alcance";

/** Familias (padreId → alumnos) que reciben un comunicado. */
export async function destinatarios(c: Pick<Comunicado, "destino" | "cursoId" | "nivel">) {
  const [als, cs, fams] = await Promise.all([todosLosAlumnos(), todosLosCursos(), db.familias.todos()]);
  const alcanzados = als.filter((a) => {
    if (c.destino === "todos") return true;
    if (c.destino === "curso") return a.cursoId === c.cursoId;
    return cs.find((x) => x.id === a.cursoId)?.nivel === c.nivel;
  });
  const ids = new Set(alcanzados.map((a) => a.id));
  const porPadre = new Map<number, typeof alcanzados>();
  for (const f of fams) if (ids.has(f.alumnoId)) porPadre.set(f.padreId, [...(porPadre.get(f.padreId) ?? []), alcanzados.find((a) => a.id === f.alumnoId)!]);
  return porPadre;
}
