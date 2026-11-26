/**
 * Acceso a datos sobre Redis (Upstash).
 * Cada "tabla" chica es un hash cd:t:<nombre> con id → JSON.
 * Lo que crece mucho (asistencia, notas, cuotas, avisos, lecturas) se guarda en un hash por alumno o por usuario.
 */
import { kv } from "./redis";
import type * as T from "./tipos";

export * from "./tipos";
export { kv, usaUpstash } from "./redis";

const P = "cd";
const ahora = () => new Date().toISOString();

type ConId = { id: number };

export function tabla<R extends ConId>(nombre: string) {
  const key = `${P}:t:${nombre}`;
  const seq = `${P}:seq:${nombre}`;
  const parse = (s: string | null) => (s ? (JSON.parse(s) as R) : null);
  return {
    key,
    async todos(filtro?: (r: R) => boolean): Promise<R[]> {
      const h = await kv.hgetall(key);
      const rows = Object.values(h).map((s) => JSON.parse(s) as R).sort((a, b) => a.id - b.id);
      return filtro ? rows.filter(filtro) : rows;
    },
    async uno(id: number | string | null | undefined): Promise<R | null> {
      if (id === null || id === undefined || id === "" || Number.isNaN(Number(id))) return null;
      return parse(await kv.hget(key, String(id)));
    },
    async varios(ids: number[]): Promise<R[]> {
      const u = [...new Set(ids)];
      return (await kv.hmget(key, u.map(String))).map(parse).filter((x): x is R => x !== null);
    },
    async insertar(row: Omit<R, "id">): Promise<R> {
      const id = await kv.incrby(seq, 1);
      const r = { ...row, id } as R;
      await kv.hset(key, { [id]: JSON.stringify(r) });
      return r;
    },
    async insertarVarios(rows: Omit<R, "id">[]): Promise<R[]> {
      if (!rows.length) return [];
      const ultimo = await kv.incrby(seq, rows.length);
      const out = rows.map((r, i) => ({ ...r, id: ultimo - rows.length + 1 + i }) as R);
      await kv.hset(key, Object.fromEntries(out.map((r) => [r.id, JSON.stringify(r)])));
      return out;
    },
    async actualizar(id: number, cambios: Partial<Omit<R, "id">>): Promise<R | null> {
      const r = await this.uno(id);
      if (!r) return null;
      const n = { ...r, ...cambios, id } as R;
      await kv.hset(key, { [id]: JSON.stringify(n) });
      return n;
    },
    async borrar(ids: number | number[]) {
      await kv.hdel(key, (Array.isArray(ids) ? ids : [ids]).map(String));
    },
  };
}

/** Hash por "dueño" (alumno, usuario, comunicado…) con campos JSON. */
function porDueno<R>(prefijo: string) {
  const key = (id: number) => `${P}:${prefijo}:${id}`;
  return {
    key,
    async todos(id: number): Promise<Record<string, R>> {
      const h = await kv.hgetall(key(id));
      return Object.fromEntries(Object.entries(h).map(([f, v]) => [f, JSON.parse(v) as R]));
    },
    async lista(id: number): Promise<R[]> {
      return Object.values(await this.todos(id));
    },
    async deVarios(ids: number[]): Promise<Map<number, R[]>> {
      const res = await Promise.all(ids.map((i) => this.lista(i)));
      return new Map(ids.map((i, n) => [i, res[n]]));
    },
    async campo(id: number, campo: string): Promise<R | null> {
      const v = await kv.hget(key(id), campo);
      return v ? (JSON.parse(v) as R) : null;
    },
    async campos(id: number, campos: string[]): Promise<(R | null)[]> {
      return (await kv.hmget(key(id), campos)).map((v) => (v ? (JSON.parse(v) as R) : null));
    },
    async guardar(id: number, valores: Record<string, R>) {
      await kv.hset(key(id), Object.fromEntries(Object.entries(valores).map(([f, v]) => [f, JSON.stringify(v)])));
    },
    async borrar(id: number, campos: string[]) {
      await kv.hdel(key(id), campos);
    },
  };
}

export const db = {
  usuarios: tabla<T.Usuario>("usuarios"),
  cursos: tabla<T.Curso>("cursos"),
  alumnos: tabla<T.Alumno>("alumnos"),
  familias: tabla<T.Familia>("familias"),
  materias: tabla<T.Materia>("materias"),
  aulas: tabla<T.Aula>("aulas"),
  horarios: tabla<T.Horario>("horarios"),
  noDisponible: tabla<T.NoDisponible>("no_disponible"),
  criterios: tabla<T.Criterio>("criterios"),
  temas: tabla<T.Tema>("temas"),
  planificaciones: tabla<T.Planificacion>("planificaciones"),
  recursos: tabla<T.Recurso>("recursos"),
  convivencia: tabla<T.Convivencia>("convivencia"),
  seguimientos: tabla<T.Seguimiento>("seguimientos"),
  comunicados: tabla<T.Comunicado>("comunicados"),
  tareas: tabla<T.Tarea>("tareas"),
  turnos: tabla<T.Turno>("turnos"),
  eventos: tabla<T.Evento>("eventos"),
  salidas: tabla<T.Salida>("salidas"),
  solicitudes: tabla<T.Solicitud>("solicitudes"),
  becas: tabla<T.Beca>("becas"),
  espacios: tabla<T.Espacio>("espacios"),
  reservas: tabla<T.Reserva>("reservas"),
  ausenciasDocentes: tabla<T.AusenciaDocente>("ausencias_docentes"),
  coberturas: tabla<T.Cobertura>("coberturas"),

  /** asistencia: un hash por alumno, campo = fecha */
  asistencia: porDueno<T.Asistencia>("asis"),
  /** notas: un hash por alumno, campo = criterioId:trimestre */
  notas: porDueno<T.Calificacion>("notas"),
  /** cuotas: un hash por alumno, campo = periodo:concepto */
  cuotas: porDueno<T.Cuota>("cuotas"),
  /** lecturas y firmas de comunicados: un hash por comunicado, campo = padreId */
  lecturas: porDueno<T.Lectura>("lect"),
  /** autorizaciones de salidas: un hash por salida, campo = alumnoId */
  autorizaciones: porDueno<T.Autorizacion>("aut"),
  /** avisos: un hash por usuario */
  avisos: porDueno<T.Notificacion>("avisos"),

  /* índices */
  async idPorEmail(email: string) {
    const v = await kv.get(`${P}:email:${email.toLowerCase()}`);
    return v ? Number(v) : null;
  },
  async indexarEmail(email: string, id: number) {
    await kv.set(`${P}:email:${email.toLowerCase()}`, String(id));
  },
  async alumnoPorQr(codigo: string) {
    const v = await kv.get(`${P}:qr:${codigo.trim().toUpperCase()}`);
    return v ? Number(v) : null;
  },
  async indexarQr(codigo: string, id: number) {
    await kv.set(`${P}:qr:${codigo.toUpperCase()}`, String(id));
  },
  async solicitudPorCodigo(codigo: string) {
    const v = await kv.get(`${P}:mat:${codigo.trim().toUpperCase()}`);
    return v ? Number(v) : null;
  },
  async indexarSolicitud(codigo: string, id: number) {
    await kv.set(`${P}:mat:${codigo.toUpperCase()}`, String(id));
  },
  async siguienteId(nombre: string) {
    return kv.incrby(`${P}:seq:${nombre}`, 1);
  },
  /** Borra todos los datos de la app (solo para cargar datos de ejemplo). */
  async vaciar() {
    await kv.del(await kv.keys(`${P}:*`));
  },
};

export const claveNota = (criterioId: number, trimestre: number) => `${criterioId}:${trimestre}`;
export const claveCuota = (periodo: string, concepto: string) => `${periodo}:${concepto}`;
export { ahora };
