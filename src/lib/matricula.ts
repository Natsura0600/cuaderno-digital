import type { EstadoSolicitud } from "@/db/tipos";

export const ESTADO_SOL: Record<EstadoSolicitud, { texto: string; tono: "neutro" | "info" | "aviso" | "marca" | "ok" | "peligro"; ayuda: string }> = {
  recibida: { texto: "Recibida", tono: "neutro", ayuda: "Recibimos la solicitud. La revisamos en los próximos días hábiles." },
  en_revision: { texto: "En revisión", tono: "info", ayuda: "Secretaría está revisando los datos y la documentación." },
  documentacion_pendiente: { texto: "Falta documentación", tono: "aviso", ayuda: "Falta algún documento. Mirá las observaciones." },
  entrevista: { texto: "Entrevista", tono: "marca", ayuda: "Te vamos a contactar para coordinar una entrevista con el equipo directivo." },
  aceptada: { texto: "Aceptada", tono: "ok", ayuda: "¡Bienvenidos! Te enviamos el usuario para ingresar a la app." },
  rechazada: { texto: "Sin vacante", tono: "peligro", ayuda: "Por ahora no hay vacante. Quedan en lista de espera." },
};

export const ORDEN_ESTADOS: EstadoSolicitud[] = ["recibida", "en_revision", "documentacion_pendiente", "entrevista", "aceptada"];

export const DOCUMENTOS = [
  { campo: "doc_dni", nombre: "DNI del alumno (frente y dorso)" },
  { campo: "doc_partida", nombre: "Partida de nacimiento" },
  { campo: "doc_vacunas", nombre: "Certificado de vacunación" },
  { campo: "doc_boletin", nombre: "Último boletín o pase" },
];
