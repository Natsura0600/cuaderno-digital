/**
 * Generador de horarios. Lógica pura (sin base de datos) para poder probarla.
 * Coloca cada hora semanal de cada materia en la grilla respetando:
 *  - un curso no puede tener dos materias en el mismo módulo
 *  - un profesor no puede estar en dos cursos a la vez
 *  - un aula especial (gimnasio, laboratorio) no puede usarse dos veces a la vez
 *  - los módulos que el profesor marcó como no disponibles
 * Además intenta no poner más de 2 módulos de la misma materia en un día
 * y agrupa los módulos de a pares cuando puede.
 */

export type MateriaGen = {
  id: number;
  cursoId: number;
  profesorId: number | null;
  horas: number;
  aulaId: number | null; // aula especial requerida (null = aula del curso)
};
export type Slot = { materiaId: number; cursoId: number; aulaId: number | null; dia: number; modulo: number };
export type ResultadoGen = { slots: Slot[]; sinUbicar: { materiaId: number; horas: number }[] };

export function generarHorario(
  materias: MateriaGen[],
  noDisp: { profesorId: number; dia: number; modulo: number }[],
  opts: { dias?: number; modulos?: number; intentos?: number; semilla?: number } = {},
): ResultadoGen {
  const DIAS = opts.dias ?? 5;
  const MODS = opts.modulos ?? 7;
  const intentos = opts.intentos ?? 60;
  let mejor: ResultadoGen | null = null;
  let seed = opts.semilla ?? 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const bloqueado = new Set(noDisp.map((n) => `${n.profesorId}-${n.dia}-${n.modulo}`));

  for (let it = 0; it < intentos; it++) {
    const ocupCurso = new Set<string>();
    const ocupProf = new Set<string>();
    const ocupAula = new Set<string>();
    const porDia = new Map<string, number>();
    const slots: Slot[] = [];
    const sinUbicar: { materiaId: number; horas: number }[] = [];

    // Primero las más difíciles: más horas, profesor con más carga, aula especial
    const carga = new Map<number, number>();
    for (const m of materias) if (m.profesorId) carga.set(m.profesorId, (carga.get(m.profesorId) ?? 0) + m.horas);
    const orden = [...materias].sort(
      (a, b) =>
        (b.aulaId ? 1 : 0) - (a.aulaId ? 1 : 0) ||
        (carga.get(b.profesorId ?? 0) ?? 0) - (carga.get(a.profesorId ?? 0) ?? 0) ||
        b.horas - a.horas ||
        rnd() - 0.5,
    );

    for (const m of orden) {
      let faltan = m.horas;
      const libre = (d: number, mod: number) =>
        mod >= 1 &&
        mod <= MODS &&
        !ocupCurso.has(`${m.cursoId}-${d}-${mod}`) &&
        (!m.profesorId || (!ocupProf.has(`${m.profesorId}-${d}-${mod}`) && !bloqueado.has(`${m.profesorId}-${d}-${mod}`))) &&
        (!m.aulaId || !ocupAula.has(`${m.aulaId}-${d}-${mod}`));
      const poner = (d: number, mod: number) => {
        ocupCurso.add(`${m.cursoId}-${d}-${mod}`);
        if (m.profesorId) ocupProf.add(`${m.profesorId}-${d}-${mod}`);
        if (m.aulaId) ocupAula.add(`${m.aulaId}-${d}-${mod}`);
        porDia.set(`${m.id}-${d}`, (porDia.get(`${m.id}-${d}`) ?? 0) + 1);
        slots.push({ materiaId: m.id, cursoId: m.cursoId, aulaId: m.aulaId, dia: d, modulo: mod });
        faltan--;
      };
      const dias = Array.from({ length: DIAS }, (_, i) => i + 1).sort(() => rnd() - 0.5);
      // Pasada 1: bloques dobles en días distintos
      for (const d of dias) {
        if (faltan < 2) break;
        if ((porDia.get(`${m.id}-${d}`) ?? 0) > 0) continue;
        const mods = Array.from({ length: MODS - 1 }, (_, i) => i + 1).sort(() => rnd() - 0.5);
        for (const mod of mods) {
          if (libre(d, mod) && libre(d, mod + 1)) {
            poner(d, mod);
            poner(d, mod + 1);
            break;
          }
        }
      }
      // Pasada 2: módulos sueltos, máximo 2 por día
      for (const tope of [2, MODS]) {
        for (const d of dias) {
          if (!faltan) break;
          for (let mod = 1; mod <= MODS && faltan; mod++) {
            if ((porDia.get(`${m.id}-${d}`) ?? 0) >= tope) break;
            if (libre(d, mod)) poner(d, mod);
          }
        }
      }
      if (faltan) sinUbicar.push({ materiaId: m.id, horas: faltan });
    }
    const res = { slots, sinUbicar };
    const falt = (r: ResultadoGen) => r.sinUbicar.reduce((s, x) => s + x.horas, 0);
    if (!mejor || falt(res) < falt(mejor)) mejor = res;
    if (falt(mejor) === 0) break;
  }
  return mejor!;
}

export type Conflicto = { tipo: "profesor" | "aula" | "curso" | "disponibilidad"; dia: number; modulo: number; detalle: string; ids: number[] };

/** Detecta superposiciones en una grilla ya cargada (por ejemplo, después de editarla a mano). */
export function detectarConflictos(
  filas: { id: number; cursoId: number; curso: string; materia: string; profesorId: number | null; profesor: string | null; aulaId: number | null; aula: string | null; dia: number; modulo: number }[],
  noDisp: { profesorId: number; dia: number; modulo: number }[],
): Conflicto[] {
  const out: Conflicto[] = [];
  const agrupar = (clave: (f: (typeof filas)[number]) => string | null) => {
    const m = new Map<string, typeof filas>();
    for (const f of filas) {
      const k = clave(f);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  };
  for (const g of agrupar((f) => (f.profesorId ? `${f.profesorId}-${f.dia}-${f.modulo}` : null)))
    out.push({ tipo: "profesor", dia: g[0].dia, modulo: g[0].modulo, detalle: `${g[0].profesor} figura a la vez en ${g.map((x) => x.curso).join(" y ")}`, ids: g.map((x) => x.id) });
  for (const g of agrupar((f) => (f.aulaId ? `${f.aulaId}-${f.dia}-${f.modulo}` : null)))
    out.push({ tipo: "aula", dia: g[0].dia, modulo: g[0].modulo, detalle: `${g[0].aula} asignada a ${g.map((x) => x.curso).join(" y ")}`, ids: g.map((x) => x.id) });
  for (const g of agrupar((f) => `${f.cursoId}-${f.dia}-${f.modulo}`))
    out.push({ tipo: "curso", dia: g[0].dia, modulo: g[0].modulo, detalle: `${g[0].curso} tiene ${g.map((x) => x.materia).join(" y ")} en el mismo módulo`, ids: g.map((x) => x.id) });
  const nd = new Set(noDisp.map((n) => `${n.profesorId}-${n.dia}-${n.modulo}`));
  for (const f of filas)
    if (f.profesorId && nd.has(`${f.profesorId}-${f.dia}-${f.modulo}`))
      out.push({ tipo: "disponibilidad", dia: f.dia, modulo: f.modulo, detalle: `${f.profesor} marcó este módulo como no disponible (${f.curso}, ${f.materia})`, ids: [f.id] });
  return out.sort((a, b) => a.dia - b.dia || a.modulo - b.modulo);
}
