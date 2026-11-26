import { Chip, type Tono } from "./ui";

export const TIPO_EVENTO: Record<string, { texto: string; tono: Tono; color: string }> = {
  evaluacion: { texto: "Evaluación", tono: "peligro", color: "bg-bad" },
  acto: { texto: "Acto", tono: "marca", color: "bg-brand" },
  salida: { texto: "Salida", tono: "info", color: "bg-info" },
  feriado: { texto: "Sin clases", tono: "neutro", color: "bg-muted" },
  reunion: { texto: "Reunión", tono: "oro", color: "bg-gold" },
  otro: { texto: "Otro", tono: "neutro", color: "bg-muted" },
  tarea: { texto: "Tarea", tono: "aviso", color: "bg-warn" },
  material: { texto: "Material", tono: "oro", color: "bg-gold" },
};

export function ChipEvento({ tipo }: { tipo: string }) {
  const t = TIPO_EVENTO[tipo] ?? TIPO_EVENTO.otro;
  return <Chip tono={t.tono}>{t.texto}</Chip>;
}
