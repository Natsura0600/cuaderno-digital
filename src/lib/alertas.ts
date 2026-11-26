import "server-only";
import { db } from "@/db";
import { REGLAS } from "./config";
import { hoy, sumarDias } from "./fechas";
import { fmtNota, promedioTrimestre, riesgoAcademico, valorFalta } from "./notas";
import { alumnosDeCursos, todosLosCursos, todasLasMaterias } from "./alcance";

export type Alerta = {
  alumnoId: number;
  nombre: string;
  curso: string;
  cursoId: number;
  puntaje: number;
  nivel: "media" | "alta";
  motivos: { tipo: "asistencia" | "notas" | "convivencia"; texto: string }[];
  faltasAnio: number;
};

/**
 * Cruza asistencia, notas y convivencia para encontrar alumnos con riesgo de abandono.
 * Cada señal suma puntos; con 2 o más es "media", con 4 o más es "alta".
 */
export async function calcularAlertas(cursoIds: number[]): Promise<Alerta[]> {
  if (!cursoIds.length) return [];
  const als = await alumnosDeCursos(cursoIds);
  if (!als.length) return [];
  const ids = als.map((a) => a.id);
  const desde30 = sumarDias(hoy(), -30);
  const desde60 = sumarDias(hoy(), -60);
  const [cs, mats, crs, asis, notas, conv] = await Promise.all([
    todosLosCursos(),
    todasLasMaterias(),
    db.criterios.todos(),
    db.asistencia.deVarios(ids),
    db.notas.deVarios(ids),
    db.convivencia.todos((c) => c.tipo === "incidente" && c.fecha >= desde60),
  ]);
  const critPorId = new Map(crs.map((c) => [c.id, c]));

  const out: Alerta[] = [];
  for (const a of als) {
    const motivos: Alerta["motivos"] = [];
    let puntaje = 0;
    const misAsis = asis.get(a.id) ?? [];
    const faltasAnio = misAsis.reduce((s, x) => s + valorFalta(x.estado), 0);
    const faltas30 = misAsis.filter((x) => x.fecha >= desde30).reduce((s, x) => s + valorFalta(x.estado), 0);
    if (faltasAnio >= REGLAS.limiteInasistencias - 5) {
      puntaje += 3;
      motivos.push({ tipo: "asistencia", texto: `${fmtNota(faltasAnio)} inasistencias en el año (tope ${REGLAS.limiteInasistencias})` });
    } else if (faltasAnio >= REGLAS.avisoInasistencias) {
      puntaje += 2;
      motivos.push({ tipo: "asistencia", texto: `${fmtNota(faltasAnio)} inasistencias en el año` });
    }
    if (faltas30 >= 4) {
      puntaje += 2;
      motivos.push({ tipo: "asistencia", texto: `${fmtNota(faltas30)} faltas en los últimos 30 días` });
    }
    const porMateria = new Map<number, { criterioId: number; peso: number; nota: number; trimestre: number }[]>();
    for (const n of notas.get(a.id) ?? []) {
      const c = critPorId.get(n.criterioId);
      if (!c) continue;
      porMateria.set(c.materiaId, [...(porMateria.get(c.materiaId) ?? []), { ...n, peso: c.peso }]);
    }
    let enRiesgo = 0;
    let enCaida = 0;
    for (const ns of porMateria.values()) {
      const r = riesgoAcademico([1, 2, 3].map((t) => promedioTrimestre(ns, t)));
      if (r.nivel === "riesgo") enRiesgo++;
      else if (r.nivel === "atencion") enCaida++;
    }
    // "riesgo" = promedio bajo 6; "atención" = bajo 7 o en caída fuerte (pesa la mitad)
    const peso = enRiesgo + enCaida / 2;
    const bajas = enRiesgo + enCaida;
    if (peso >= 3) {
      puntaje += 3;
      motivos.push({ tipo: "notas", texto: `${bajas} materias por debajo de ${REGLAS.notaAprobacion} o en caída` });
    } else if (enRiesgo >= 1 || enCaida >= 3) {
      puntaje += enRiesgo ? 2 : 1;
      motivos.push({ tipo: "notas", texto: `${bajas} materia${bajas > 1 ? "s" : ""} con notas bajas` });
    }
    const misConv = conv.filter((c) => c.alumnoId === a.id);
    const graves = misConv.filter((c) => c.gravedad === "grave").length;
    if (graves) {
      puntaje += 2;
      motivos.push({ tipo: "convivencia", texto: `${graves} incidente${graves > 1 ? "s" : ""} grave${graves > 1 ? "s" : ""} en 60 días` });
    } else if (misConv.length >= 3) {
      puntaje += 1;
      motivos.push({ tipo: "convivencia", texto: `${misConv.length} incidentes en 60 días` });
    }
    if (puntaje >= 2) {
      const c = cs.find((x) => x.id === a.cursoId)!;
      out.push({ alumnoId: a.id, nombre: `${a.apellido}, ${a.nombre}`, curso: c.nombre, cursoId: c.id, puntaje, nivel: puntaje >= 4 ? "alta" : "media", motivos, faltasAnio });
    }
  }
  void mats;
  return out.sort((x, y) => y.puntaje - x.puntaje);
}
