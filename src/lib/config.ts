export const COLEGIO = process.env.NEXT_PUBLIC_COLEGIO ?? "Colegio Montessori de Luján";
export const SEDE = process.env.NEXT_PUBLIC_SEDE ?? "Sede Acceso Oeste";
export const APP = "Cuaderno Digital";

/** Reglas institucionales. Ajustarlas acá cambia toda la app. */
export const REGLAS = {
  notaAprobacion: 7, // escala 1 a 10 (Provincia de Buenos Aires, secundaria)
  maxEvaluacionesPorDia: 2,
  limiteInasistencias: 28, // tope anual antes de quedar libre
  avisoInasistencias: 15, // primer aviso / reincorporación
  valorTarde: 0.25, // una llegada tarde suma ¼ de falta
  modulosPorDia: 7,
  trimestreActual: 3,
};

export const MODULOS = [
  { n: 1, desde: "07:30", hasta: "08:10" },
  { n: 2, desde: "08:10", hasta: "08:50" },
  { n: 3, desde: "09:00", hasta: "09:40" },
  { n: 4, desde: "09:40", hasta: "10:20" },
  { n: 5, desde: "10:30", hasta: "11:10" },
  { n: 6, desde: "11:10", hasta: "11:50" },
  { n: 7, desde: "12:00", hasta: "12:40" },
];

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
