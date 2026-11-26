/** Categorías y protocolos de actuación de convivencia. Editables por la institución. */
export const CATEGORIAS_INCIDENTE: Record<string, { gravedadSugerida: "leve" | "moderada" | "grave"; pasos: string[] }> = {
  "Llegadas tarde reiteradas": {
    gravedadSugerida: "leve",
    pasos: ["Conversación del preceptor con el alumno", "Aviso a la familia", "Acuerdo escrito de puntualidad"],
  },
  "Uso indebido del celular": {
    gravedadSugerida: "leve",
    pasos: ["Llamado de atención en clase", "Registro y aviso a la familia", "Retiro del dispositivo hasta el final de la jornada"],
  },
  "Falta de respeto": {
    gravedadSugerida: "moderada",
    pasos: ["Escucha a las partes", "Reflexión guiada con el tutor", "Comunicación con la familia", "Acción reparadora acordada"],
  },
  "Conflicto entre pares": {
    gravedadSugerida: "moderada",
    pasos: ["Separar y escuchar a cada parte", "Mediación entre pares", "Seguimiento a la semana", "Cierre con acuerdo"],
  },
  "Daño a materiales o instalaciones": {
    gravedadSugerida: "moderada",
    pasos: ["Registro del daño", "Entrevista con el alumno", "Citación a la familia", "Reparación o reposición"],
  },
  "Sospecha de acoso escolar": {
    gravedadSugerida: "grave",
    pasos: [
      "Informar de inmediato al equipo directivo",
      "Proteger al alumno afectado y garantizar confidencialidad",
      "Entrevistas por separado con las partes",
      "Citación a las familias",
      "Intervención del Equipo de Orientación Escolar",
      "Plan de seguimiento y revisión en 15 días",
    ],
  },
  "Situación de riesgo / salud": {
    gravedadSugerida: "grave",
    pasos: ["Atender al alumno y llamar a emergencias si corresponde", "Avisar a la familia", "Informar a dirección", "Registro y seguimiento del EOE"],
  },
  Otro: { gravedadSugerida: "leve", pasos: ["Registro", "Evaluación con el equipo", "Seguimiento"] },
};

export const CATEGORIAS_RECONOCIMIENTO = [
  "Compañerismo",
  "Esfuerzo y superación",
  "Liderazgo positivo",
  "Participación en proyectos",
  "Cuidado del ambiente",
  "Responsabilidad",
];
