export const COLEGIO = process.env.NEXT_PUBLIC_COLEGIO ?? "Colegio Montessori de Luján";
export const SEDE = process.env.NEXT_PUBLIC_SEDE ?? "Sede Acceso Oeste";
export const APP = "Cuaderno Digital";

export type Reglas = {
  cicloLectivo: number;
  trimestreActual: number;
  notaAprobacion: number;
  maxEvaluacionesPorDia: number;
  limiteInasistencias: number;
  avisoInasistencias: number;
  valorTarde: number;
  horaTarde: string;
  modulosPorDia: number;
};
export type Modulo = { n: number; desde: string; hasta: string };

export const REGLAS_POR_DEFECTO: Reglas = {
  cicloLectivo: new Date().getFullYear(),
  trimestreActual: 1,
  notaAprobacion: 7, // escala 1 a 10 (Provincia de Buenos Aires, secundaria)
  maxEvaluacionesPorDia: 2,
  limiteInasistencias: 28, // tope anual antes de quedar libre
  avisoInasistencias: 15, // primer aviso / reincorporación
  valorTarde: 0.25, // una llegada tarde suma ¼ de falta
  horaTarde: "07:45", // desde esta hora, el ingreso por QR cuenta como llegada tarde
  modulosPorDia: 7,
};

export const MODULOS_POR_DEFECTO: Modulo[] = [
  { n: 1, desde: "07:30", hasta: "08:10" },
  { n: 2, desde: "08:10", hasta: "08:50" },
  { n: 3, desde: "09:00", hasta: "09:40" },
  { n: 4, desde: "09:40", hasta: "10:20" },
  { n: 5, desde: "10:30", hasta: "11:10" },
  { n: 6, desde: "11:10", hasta: "11:50" },
  { n: 7, desde: "12:00", hasta: "12:40" },
];

/**
 * Reglas institucionales vigentes. Son las mismas para todo el colegio, así que se guardan
 * en la base (Configuración) y se cargan en memoria en cada pedido con src/lib/ajustes.ts.
 */
export const REGLAS: Reglas = { ...REGLAS_POR_DEFECTO };
export const MODULOS: Modulo[] = MODULOS_POR_DEFECTO.map((m) => ({ ...m }));

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
