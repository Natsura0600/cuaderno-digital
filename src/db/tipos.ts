/* Tipos de los datos guardados. Las fechas son "YYYY-MM-DD" y los instantes, ISO 8601. */

export const ROLES = ["padre", "profesor", "preceptor", "directivo"] as const;
export type Rol = (typeof ROLES)[number];
export type Nivel = "inicial" | "primaria" | "secundaria";

export type Usuario = {
  id: number; nombre: string; apellido: string; email: string; passwordHash: string; rol: Rol;
  telefono: string | null; cargo: string | null; activo: boolean; creado: string;
};
export type Curso = { id: number; nombre: string; nivel: Nivel; anio: number; division: string; turno: "mañana" | "tarde"; preceptorId: number | null };
export type Alumno = { id: number; nombre: string; apellido: string; dni: string; fechaNac: string | null; cursoId: number; codigoQr: string; activo: boolean };
export type Familia = { id: number; padreId: number; alumnoId: number; vinculo: string };
export type Materia = { id: number; nombre: string; area: string; cursoId: number; profesorId: number | null; horasSemanales: number };
export type Aula = { id: number; nombre: string; tipo: "aula" | "laboratorio" | "gimnasio" | "sala" | "biblioteca"; capacidad: number };

export type Horario = { id: number; cursoId: number; materiaId: number; aulaId: number | null; dia: number; modulo: number };
export type NoDisponible = { id: number; profesorId: number; dia: number; modulo: number };
export type Criterio = { id: number; materiaId: number; nombre: string; peso: number };
export type Tema = { id: number; materiaId: number; unidad: number; titulo: string; orden: number };
export type Planificacion = { id: number; materiaId: number; semana: string; objetivos: string; actividades: string; dictada: boolean; temaIds: number[]; creado: string };
export type Recurso = {
  id: number; titulo: string; tipo: "guia" | "examen" | "presentacion" | "otro"; nivel: string; anio: number; materia: string; unidad: number | null;
  descripcion: string | null; url: string | null; archivo: string | null; archivoNombre: string | null; soloDocentes: boolean; autorId: number; creado: string;
};

export const ESTADOS_ASISTENCIA = ["presente", "ausente", "tarde", "justificado"] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];
export type Asistencia = { fecha: string; estado: EstadoAsistencia; metodo: "manual" | "qr"; tomadaPor: number | null; hora: string };
export type Calificacion = { criterioId: number; trimestre: number; nota: number; fecha: string; observacion?: string };

export type Convivencia = {
  id: number; alumnoId: number; tipo: "incidente" | "reconocimiento"; categoria: string; gravedad: "leve" | "moderada" | "grave" | null;
  descripcion: string; estado: "abierto" | "en_seguimiento" | "cerrado"; visibleFamilia: boolean; autorId: number; fecha: string;
};
export type Seguimiento = { id: number; registroId: number; autorId: number; nota: string; pasoProtocolo: number | null; creado: string };

export type Comunicado = {
  id: number; titulo: string; cuerpo: string; autorId: number; destino: "todos" | "nivel" | "curso"; nivel: string | null; cursoId: number | null;
  tipo: "informativo" | "firma" | "autorizacion"; creado: string;
};
export type Lectura = { padreId: number; leido: string; firmado: string | null; respuesta: "autorizo" | "no_autorizo" | null };
export type Tarea = { id: number; materiaId: number; tipo: "tarea" | "material"; titulo: string; descripcion: string | null; fecha: string; autorId: number };
export type Turno = {
  id: number; docenteId: number; inicio: string; minutos: number; modalidad: "presencial" | "virtual";
  padreId: number | null; alumnoId: number | null; motivo: string | null; cancelado: boolean;
};
export type Notificacion = { id: number; titulo: string; cuerpo: string | null; link: string | null; tipo: string; leida: boolean; creado: string };

export const TIPOS_EVENTO = ["evaluacion", "acto", "salida", "feriado", "reunion", "otro"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type Evento = {
  id: number; titulo: string; tipo: TipoEvento; fecha: string; hora: string | null; cursoId: number | null; materiaId: number | null;
  descripcion: string | null; autorId: number;
};
export type Salida = {
  id: number; titulo: string; destino: string; fecha: string; horaSalida: string; horaRegreso: string; cursoId: number; costo: number;
  descripcion: string | null; eventoId: number | null; autorId: number; responsables: number[];
};
export type Autorizacion = { alumnoId: number; padreId: number | null; autorizado: boolean | null; firmado: string | null; pagado: boolean };

export const ESTADOS_SOLICITUD = ["recibida", "en_revision", "documentacion_pendiente", "entrevista", "aceptada", "rechazada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];
export type Solicitud = {
  id: number; codigo: string; tipo: "nueva" | "reinscripcion"; padreId: number | null; alumnoId: number | null;
  alumnoNombre: string; alumnoApellido: string; alumnoDni: string; alumnoFechaNac: string | null; nivel: string; anio: number; cicloLectivo: number;
  tutorNombre: string; tutorEmail: string; tutorTelefono: string; escuelaAnterior: string | null; comentarios: string | null;
  estado: EstadoSolicitud; observaciones: string | null; documentos: { nombre: string; archivo: string }[]; creado: string;
};
export type Cuota = {
  alumnoId: number; periodo: string; concepto: string; montoBase: number; descuento: number; vencimiento: string; pagada: string | null; medio: string | null;
};
export type Beca = { id: number; alumnoId: number; porcentaje: number; motivo: string; vigente: boolean };
export type Espacio = {
  id: number; nombre: string; tipo: "espacio" | "equipo"; categoria: string; cantidad: number; ubicacion: string | null; estado: "disponible" | "en_reparacion" | "baja";
};
export type Reserva = { id: number; espacioId: number; usuarioId: number; fecha: string; moduloDesde: number; moduloHasta: number; motivo: string | null };
export type AusenciaDocente = { id: number; profesorId: number; fecha: string; motivo: string; registradoPor: number };
export type Cobertura = { id: number; ausenciaId: number; horarioId: number; reemplazanteId: number };
