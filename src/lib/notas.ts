import { REGLAS } from "./config";

export type NotaCriterio = { criterioId: number; peso: number; nota: number; trimestre: number };

/** Promedio ponderado por criterio para un trimestre (o null si no hay notas). */
export function promedioTrimestre(notas: NotaCriterio[], trimestre: number): number | null {
  const ns = notas.filter((n) => n.trimestre === trimestre);
  if (!ns.length) return null;
  const pesoTotal = ns.reduce((s, n) => s + n.peso, 0);
  return Math.round((ns.reduce((s, n) => s + n.nota * n.peso, 0) / pesoTotal) * 100) / 100;
}

export type Riesgo = { nivel: "ok" | "atencion" | "riesgo"; motivo: string | null };

/** Señal temprana: bajo la nota de aprobación, o caída fuerte respecto del trimestre anterior. */
export function riesgoAcademico(proms: (number | null)[]): Riesgo {
  const validos = proms.map((p, i) => ({ p, t: i + 1 })).filter((x) => x.p !== null) as { p: number; t: number }[];
  if (!validos.length) return { nivel: "ok", motivo: null };
  const ultimo = validos[validos.length - 1];
  const previo = validos.length > 1 ? validos[validos.length - 2] : null;
  if (ultimo.p < REGLAS.notaAprobacion - 1) return { nivel: "riesgo", motivo: `Promedio ${fmtNota(ultimo.p)} en el ${ultimo.t}° trimestre` };
  if (ultimo.p < REGLAS.notaAprobacion) return { nivel: "atencion", motivo: `Promedio ${fmtNota(ultimo.p)}, debajo de ${REGLAS.notaAprobacion}` };
  if (previo && previo.p - ultimo.p >= 1.5) return { nivel: "atencion", motivo: `Bajó de ${fmtNota(previo.p)} a ${fmtNota(ultimo.p)}` };
  return { nivel: "ok", motivo: null };
}

export function fmtNota(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 1 : 0 });
}

/** Valor de una inasistencia según su estado. */
export function valorFalta(estado: string): number {
  if (estado === "ausente") return 1;
  if (estado === "tarde") return REGLAS.valorTarde;
  return 0; // presente o justificado
}
