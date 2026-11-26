import type { Rol } from "@/db/tipos";

export type ItemNav = { href: string; texto: string; icono: string; grupo: string };

const I = (href: string, texto: string, icono: string, grupo: string): ItemNav => ({ href, texto, icono, grupo });

export const NAV: Record<Rol, ItemNav[]> = {
  padre: [
    I("/inicio", "Inicio", "home", "General"),
    I("/agenda", "Agenda", "notebook", "General"),
    I("/comunicados", "Comunicados", "mail", "General"),
    I("/asistencia", "Asistencia", "check", "Seguimiento"),
    I("/calificaciones", "Calificaciones", "grad", "Seguimiento"),
    I("/convivencia", "Convivencia", "heart", "Seguimiento"),
    I("/horarios", "Horario", "clock", "Seguimiento"),
    I("/calendario", "Calendario", "calendar", "Colegio"),
    I("/salidas", "Salidas", "bus", "Colegio"),
    I("/reuniones", "Reuniones", "users", "Colegio"),
    I("/recursos", "Recursos", "folder", "Colegio"),
    I("/pagos", "Pagos", "wallet", "Administración"),
    I("/matricula", "Matrícula", "file", "Administración"),
  ],
  profesor: [
    I("/inicio", "Inicio", "home", "General"),
    I("/horarios", "Mi horario", "clock", "General"),
    I("/calificaciones", "Calificaciones", "grad", "Enseñanza"),
    I("/planificacion", "Planificación", "list", "Enseñanza"),
    I("/agenda", "Tareas y materiales", "notebook", "Enseñanza"),
    I("/recursos", "Banco de recursos", "folder", "Enseñanza"),
    I("/calendario", "Calendario", "calendar", "Colegio"),
    I("/comunicados", "Comunicados", "mail", "Colegio"),
    I("/reuniones", "Reuniones", "users", "Colegio"),
    I("/convivencia", "Convivencia", "heart", "Colegio"),
    I("/salidas", "Salidas", "bus", "Colegio"),
    I("/espacios", "Reservar espacios", "box", "Colegio"),
  ],
  preceptor: [
    I("/inicio", "Inicio", "home", "General"),
    I("/asistencia", "Tomar asistencia", "check", "Cursos"),
    I("/convivencia", "Convivencia", "heart", "Cursos"),
    I("/alertas", "Alertas tempranas", "alert", "Cursos"),
    I("/calificaciones", "Calificaciones", "grad", "Cursos"),
    I("/horarios", "Horarios", "clock", "Cursos"),
    I("/reemplazos", "Reemplazos", "swap", "Cursos"),
    I("/comunicados", "Comunicados", "mail", "Colegio"),
    I("/calendario", "Calendario", "calendar", "Colegio"),
    I("/salidas", "Salidas", "bus", "Colegio"),
    I("/reuniones", "Reuniones", "users", "Colegio"),
    I("/espacios", "Reservar espacios", "box", "Colegio"),
  ],
  directivo: [
    I("/inicio", "Panel", "home", "General"),
    I("/alertas", "Alertas tempranas", "alert", "General"),
    I("/cursos", "Cursos", "layers", "Académico"),
    I("/materias", "Materias y docentes", "book", "Académico"),
    I("/horarios", "Horarios", "clock", "Académico"),
    I("/calificaciones", "Calificaciones", "grad", "Académico"),
    I("/planificacion", "Planificación", "list", "Académico"),
    I("/recursos", "Banco de recursos", "folder", "Académico"),
    I("/asistencia", "Asistencia", "check", "Convivencia"),
    I("/convivencia", "Convivencia", "heart", "Convivencia"),
    I("/comunicados", "Comunicados", "mail", "Comunicación"),
    I("/reuniones", "Reuniones", "users", "Comunicación"),
    I("/calendario", "Calendario", "calendar", "Comunicación"),
    I("/salidas", "Salidas", "bus", "Comunicación"),
    I("/matricula", "Matrícula", "file", "Administración"),
    I("/pagos", "Pagos y becas", "wallet", "Administración"),
    I("/espacios", "Inventario y espacios", "box", "Administración"),
    I("/reemplazos", "Reemplazos", "swap", "Administración"),
    I("/usuarios", "Comunidad", "id", "Administración"),
    I("/configuracion", "Configuración", "settings", "Administración"),
  ],
};

/** Los 4 accesos de la barra inferior en el celular. */
export const RAPIDOS: Record<Rol, string[]> = {
  padre: ["/inicio", "/agenda", "/comunicados", "/pagos"],
  profesor: ["/inicio", "/horarios", "/calificaciones", "/agenda"],
  preceptor: ["/inicio", "/asistencia", "/convivencia", "/comunicados"],
  directivo: ["/inicio", "/alertas", "/calendario", "/comunicados"],
};

export const NOMBRE_ROL: Record<Rol, string> = {
  padre: "Familia",
  profesor: "Docente",
  preceptor: "Preceptoría",
  directivo: "Equipo directivo",
};
