const TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en Argentina, formato YYYY-MM-DD. */
export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo */
export function diaSemana(fecha: string): number {
  const d = new Date(fecha + "T12:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

export function esHabil(fecha: string): boolean {
  return diaSemana(fecha) <= 5;
}

const fmtCorta = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtLarga = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtDia = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", timeZone: "UTC" });

export const fCorta = (f: string) => fmtCorta.format(new Date(f + "T12:00:00Z"));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fLarga = (f: string) => cap(fmtLarga.format(new Date(f + "T12:00:00Z")));
export const fDia = (f: string) => cap(fmtDia.format(new Date(f + "T12:00:00Z")));

export function fHora(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
}
export function fFechaHora(d: Date): string {
  return cap(fFechaHoraMin(d));
}
export function fFechaHoraMin(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}
/** Convierte fecha+hora local de Argentina (UTC-3, sin horario de verano) a Date. */
export function aDate(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-03:00`);
}

export function pesos(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export function mesNombre(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}
