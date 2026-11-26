/**
 * Datos de ejemplo ficticios para probar la app (alumnos, docentes, familias, un año de asistencia y notas…).
 * cargarDemo() BORRA todo lo que haya en la base antes de cargar.
 */
import bcrypt from "bcryptjs";
import { db, claveCuota, claveNota } from "@/db";
import type * as T from "@/db/tipos";
import { generarHorario } from "./horarios";
import { kv } from "@/db/redis";

export async function cargarDemo(log: (m: string) => void = () => {}) {
  let semilla = 20261126;
  const rnd = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };
  const elegir = <X,>(a: X[]) => a[Math.floor(rnd() * a.length)];
  const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const sumar = (f: string, d: number) => {
    const x = new Date(f + "T12:00:00Z");
    x.setUTCDate(x.getUTCDate() + d);
    return x.toISOString().slice(0, 10);
  };
  const dow = (f: string) => {
    const d = new Date(f + "T12:00:00Z").getUTCDay();
    return d === 0 ? 7 : d;
  };
  const proxHabil = (f: string) => {
    let x = f;
    while (dow(x) > 5) x = sumar(x, 1);
    return x;
  };
  const lunes = (f: string) => sumar(f, 1 - dow(f));
  const iso = (f: string, h = "12:00") => new Date(`${f}T${h}:00-03:00`).toISOString();
  const ANIO = Number(HOY.slice(0, 4));
  const FERIADOS = new Set(["03-23", "03-24", "04-02", "04-03", "05-01", "05-25", "06-15", "06-20", "07-09", "08-17", "10-12", "11-23", "12-08"].map((d) => `${ANIO}-${d}`));
  const RECESO = (f: string) => f >= `${ANIO}-07-20` && f <= `${ANIO}-07-31`;
  const creado = new Date().toISOString();

  log("Borrando datos…");
  await db.vaciar();

  log("Usuarios…");
  const hash = await bcrypt.hash("montessori", 10);
  const U = async (nombre: string, apellido: string, email: string, rol: T.Rol, cargo: string | null = null, telefono: string | null = null) => {
    const u = await db.usuarios.insertar({ nombre, apellido, email, rol, cargo, telefono, passwordHash: hash, activo: true, creado });
    await db.indexarEmail(email, u.id);
    return u;
  };
  const directora = await U("Laura", "Méndez", "direccion@cuaderno.demo", "directivo", "Directora");
  const secretario = await U("Martín", "Ferreyra", "secretaria@cuaderno.demo", "directivo", "Secretario académico");
  const prec1 = await U("Carolina", "Ruiz", "preceptoria@cuaderno.demo", "preceptor", "Preceptora 1° y 2° año");
  const prec2 = await U("Diego", "Sosa", "preceptoria2@cuaderno.demo", "preceptor", "Preceptor 3° y 4° año");
  const PROFES = [
    { n: "Valeria", a: "Gómez", e: "profesora@cuaderno.demo", mat: ["Matemática"] },
    { n: "Pablo", a: "Acosta", e: "lengua@cuaderno.demo", mat: ["Prácticas del Lenguaje"] },
    { n: "Sofía", a: "Herrera", e: "ingles@cuaderno.demo", mat: ["Inglés"] },
    { n: "Natalia", a: "Paz", e: "biologia@cuaderno.demo", mat: ["Biología"] },
    { n: "Gustavo", a: "Ibarra", e: "historia@cuaderno.demo", mat: ["Historia", "Construcción de Ciudadanía"] },
    { n: "Florencia", a: "Ríos", e: "geografia@cuaderno.demo", mat: ["Geografía"] },
    { n: "Ramiro", a: "Benítez", e: "edfisica@cuaderno.demo", mat: ["Educación Física"] },
    { n: "Julieta", a: "Correa", e: "arte@cuaderno.demo", mat: ["Educación Artística"] },
  ];
  const profeDe = new Map<string, number>();
  const profes: T.Usuario[] = [];
  for (const p of PROFES) {
    const u = await U(p.n, p.a, p.e, "profesor", `Docente de ${p.mat.join(" y ")}`);
    profes.push(u);
    for (const m of p.mat) profeDe.set(m, u.id);
  }

  log("Cursos, aulas y materias…");
  const cursos = await db.cursos.insertarVarios(
    [1, 2, 3, 4].map((anio) => ({ nombre: `${anio}° A`, nivel: "secundaria" as const, anio, division: "A", turno: "mañana" as const, preceptorId: anio <= 2 ? prec1.id : prec2.id })),
  );
  const aulas = await db.aulas.insertarVarios([
    ...cursos.map((c) => ({ nombre: `Aula ${c.nombre}`, tipo: "aula" as const, capacidad: 30 })),
    { nombre: "Laboratorio", tipo: "laboratorio" as const, capacidad: 24 },
    { nombre: "Gimnasio", tipo: "gimnasio" as const, capacidad: 60 },
  ]);
  const lab = aulas.find((a) => a.tipo === "laboratorio")!;
  const gim = aulas.find((a) => a.tipo === "gimnasio")!;
  const aulaDe = (cursoId: number) => aulas[cursos.findIndex((c) => c.id === cursoId)].id;
  const PLAN: { nombre: string; area: string; horas: number; aula?: number }[] = [
    { nombre: "Matemática", area: "Matemática", horas: 4 },
    { nombre: "Prácticas del Lenguaje", area: "Lengua", horas: 4 },
    { nombre: "Inglés", area: "Lenguas extranjeras", horas: 3 },
    { nombre: "Biología", area: "Ciencias Naturales", horas: 3, aula: lab.id },
    { nombre: "Historia", area: "Ciencias Sociales", horas: 3 },
    { nombre: "Geografía", area: "Ciencias Sociales", horas: 3 },
    { nombre: "Construcción de Ciudadanía", area: "Ciencias Sociales", horas: 2 },
    { nombre: "Educación Física", area: "Educación Física", horas: 2, aula: gim.id },
    { nombre: "Educación Artística", area: "Artes", horas: 2 },
  ];
  const materias = await db.materias.insertarVarios(
    cursos.flatMap((c) => PLAN.map((p) => ({ nombre: p.nombre, area: p.area, cursoId: c.id, profesorId: profeDe.get(p.nombre)!, horasSemanales: p.horas }))),
  );
  const aulaEsp = (m: T.Materia) => PLAN.find((p) => p.nombre === m.nombre)?.aula ?? null;

  log("Horarios…");
  const nd = await db.noDisponible.insertarVarios([
    ...[1, 2].map((modulo) => ({ profesorId: profeDe.get("Educación Física")!, dia: 1, modulo })),
    ...[5, 6, 7].map((modulo) => ({ profesorId: profeDe.get("Inglés")!, dia: 5, modulo })),
  ]);
  const gen = generarHorario(materias.map((m) => ({ id: m.id, cursoId: m.cursoId, profesorId: m.profesorId, horas: m.horasSemanales, aulaId: aulaEsp(m) })), nd);
  await db.horarios.insertarVarios(gen.slots.map((x) => ({ ...x, aulaId: x.aulaId ?? aulaDe(x.cursoId) })));

  log("Alumnos y familias…");
  const NOMBRES = ["Agustina", "Benjamín", "Camila", "Valentino", "Martina", "Joaquín", "Catalina", "Santino", "Lucía", "Mateo", "Emma", "Thiago", "Olivia", "Bautista", "Isabella", "Felipe", "Mía", "Lautaro", "Sofía", "Lorenzo", "Delfina", "Ignacio", "Renata", "Francisco", "Abril", "Tobías", "Victoria", "Juan Cruz", "Malena", "Facundo", "Pilar", "Bruno", "Josefina", "Ciro", "Guadalupe", "Gael", "Morena", "Simón", "Ámbar", "Manuel", "Zoe", "Lisandro", "Clara", "Dante", "Paloma", "Alma"];
  const APELLIDOS = ["Fernández", "Rodríguez", "González", "Martínez", "Pérez", "Romero", "Díaz", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Benítez", "Medina", "Suárez", "Herrera", "Aguirre", "Giménez", "Molina", "Castro", "Ortiz", "Silva", "Núñez", "Luna", "Juárez", "Cabrera", "Ríos", "Morales", "Godoy", "Vera", "Ledesma", "Ferrari", "Bianchi", "Rossi", "Villalba", "Quiroga", "Pereyra", "Sánchez", "Vázquez", "Ojeda", "Domínguez", "Acuña", "Paredes", "Moreno"];
  const ADULTOS = ["Mariana", "Gabriel", "Paula", "Sebastián", "Andrea", "Hernán", "Verónica", "Leandro", "Cecilia", "Federico", "Romina", "Damián", "Silvina", "Esteban", "Lorena", "Marcelo"];
  const familia = await U("Mariana", "López", "familia@cuaderno.demo", "padre", null, "11 5555-0101");
  const alumnos: T.Alumno[] = [];
  const familias: T.Familia[] = [];
  let k = 0;
  for (const c of cursos) {
    for (let i = 0; i < 12; i++) {
      const esLopez = (c.anio === 2 || c.anio === 4) && i === 0;
      const nombre = esLopez ? (c.anio === 2 ? "Tomás" : "Julia") : NOMBRES[k % NOMBRES.length];
      const apellido = esLopez ? "López" : APELLIDOS[(k * 7 + c.anio) % APELLIDOS.length];
      k++;
      const nac = `${ANIO - 12 - c.anio}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
      const codigoQr = `CD-${Math.floor(rnd() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0")}`;
      const a = await db.alumnos.insertar({ nombre, apellido, dni: String(49000000 + k * 37 + c.anio * 1000), fechaNac: nac, cursoId: c.id, codigoQr, activo: true });
      await db.indexarQr(codigoQr, a.id);
      alumnos.push(a);
      if (esLopez) familias.push(await db.familias.insertar({ padreId: familia.id, alumnoId: a.id, vinculo: "Madre" }));
      else {
        const p = await U(ADULTOS[k % ADULTOS.length], apellido, `familia${a.id}@cuaderno.demo`, "padre", null, `11 5555-${1000 + a.id}`);
        familias.push(await db.familias.insertar({ padreId: p.id, alumnoId: a.id, vinculo: rnd() > 0.5 ? "Madre" : "Padre" }));
      }
    }
  }
  const tomas = alumnos.find((a) => a.nombre === "Tomás")!;
  const julia = alumnos.find((a) => a.nombre === "Julia" && a.apellido === "López")!;
  const perfil = new Map<number, { base: number; caida: number; faltas: number }>();
  for (const a of alumnos) perfil.set(a.id, { base: 7.3 + rnd() * 2.3, caida: 0, faltas: 0.02 + rnd() * 0.035 });
  const enRiesgo = [alumnos[5], alumnos[17], alumnos[30], alumnos[41]];
  enRiesgo.forEach((a, i) => perfil.set(a.id, { base: 6.8 + i * 0.2, caida: 0.9, faltas: 0.07 + i * 0.015 }));
  perfil.set(tomas.id, { base: 8.1, caida: 0.15, faltas: 0.05 });
  perfil.set(julia.id, { base: 8.9, caida: 0, faltas: 0.02 });

  log("Criterios y calificaciones…");
  const CRIT: Record<string, [string, number][]> = {
    Matemática: [["Resolución de problemas", 2], ["Evaluaciones escritas", 2], ["Trabajo en clase y carpeta", 1]],
    "Prácticas del Lenguaje": [["Lectura y comprensión", 2], ["Producción escrita", 2], ["Oralidad", 1]],
    Inglés: [["Comprensión (reading & listening)", 1], ["Producción (writing & speaking)", 1], ["Evaluaciones", 2]],
    "Educación Física": [["Desempeño motor", 1], ["Trabajo en equipo", 1], ["Actitud y cuidado del cuerpo", 1]],
    "Educación Artística": [["Proceso creativo", 2], ["Producción final", 1], ["Reflexión sobre la obra", 1]],
  };
  const DEF: [string, number][] = [["Trabajos prácticos", 1], ["Evaluaciones escritas", 2], ["Participación y proceso", 1]];
  const fechasTrim = [`${ANIO}-05-29`, `${ANIO}-08-28`, sumar(HOY, -6)];
  const notasPorAlumno = new Map<number, Record<string, T.Calificacion>>();
  const criterios = await db.criterios.insertarVarios(materias.flatMap((m) => (CRIT[m.nombre] ?? DEF).map(([nombre, peso]) => ({ materiaId: m.id, nombre, peso }))));
  for (const m of materias) {
    const crs = criterios.filter((c) => c.materiaId === m.id);
    for (const a of alumnos.filter((x) => x.cursoId === m.cursoId)) {
      const p = perfil.get(a.id)!;
      const afin = ((m.id * 13 + a.id * 7) % 10) / 10 - 0.45;
      const reg = notasPorAlumno.get(a.id) ?? {};
      for (const t of [1, 2, 3])
        for (const [ci, cr] of crs.entries()) {
          if (t === 3 && ci === crs.length - 1) continue;
          let nota = p.base + afin + (rnd() - 0.5) * 1.6 - p.caida * (t - 1);
          if (a.id === tomas.id && m.nombre === "Matemática") nota = [7.5, 6.6, 5.4][t - 1] + (rnd() - 0.5) * 0.6;
          nota = Math.max(1, Math.min(10, Math.round(nota * 2) / 2));
          reg[claveNota(cr.id, t)] = { criterioId: cr.id, trimestre: t, nota, fecha: fechasTrim[t - 1] };
        }
      notasPorAlumno.set(a.id, reg);
    }
  }
  await Promise.all([...notasPorAlumno].map(([id, n]) => db.notas.guardar(id, n)));

  log("Currículo y planificaciones…");
  const UNIDADES: Record<string, string[][]> = {
    Matemática: [["Números enteros", "Operaciones combinadas", "Potencias y raíces", "Problemas con enteros"], ["Expresiones algebraicas", "Ecuaciones de primer grado", "Inecuaciones", "Sistemas sencillos"], ["Funciones y gráficos", "Proporcionalidad", "Estadística descriptiva", "Probabilidad"]],
    "Prácticas del Lenguaje": [["El cuento fantástico", "Narrador y punto de vista", "Taller de escritura", "Ortografía: acentuación"], ["La argumentación", "Textos de opinión", "Debate en el aula", "Conectores"], ["Poesía", "Recursos expresivos", "Teatro: lectura de obras", "Proyecto de antología"]],
    Biología: [["La célula", "Niveles de organización", "Microscopía", "Informe de laboratorio"], ["Nutrición", "Sistema digestivo", "Sistema circulatorio", "Alimentación saludable"], ["Ecosistemas", "Cadenas tróficas", "Biodiversidad local: el río Luján", "Proyecto ambiental"]],
    Historia: [["Fuentes históricas", "Sociedades originarias", "Conquista de América", "Vida colonial"], ["Revolución de Mayo", "Guerras de independencia", "Autonomías provinciales", "Organización nacional"], ["Modelo agroexportador", "Inmigración", "Luján en la historia regional", "Línea de tiempo integradora"]],
  };
  const DEFU = [["Introducción a la materia", "Conceptos clave", "Lectura de fuentes", "Trabajo práctico 1"], ["Profundización", "Estudio de casos", "Trabajo en grupo", "Trabajo práctico 2"], ["Integración", "Proyecto final", "Presentaciones", "Cierre y autoevaluación"]];
  const semanas: string[] = [];
  for (let f = lunes(`${ANIO}-03-02`); f < lunes(HOY); f = sumar(f, 7)) if (!RECESO(f)) semanas.push(f);
  const temas = await db.temas.insertarVarios(materias.flatMap((m) => (UNIDADES[m.nombre] ?? DEFU).flatMap((u, ui) => u.map((titulo, ti) => ({ materiaId: m.id, unidad: ui + 1, titulo, orden: ui * 10 + ti })))));
  const planes: Omit<T.Planificacion, "id">[] = [];
  for (const m of materias) {
    const ts = temas.filter((t) => t.materiaId === m.id);
    const avance = m.nombre === "Matemática" && m.cursoId === tomas.cursoId ? 0.58 : 0.7 + rnd() * 0.25;
    const dados = ts.slice(0, Math.round(ts.length * avance));
    const paso = Math.max(1, Math.floor(semanas.length / Math.max(1, dados.length)));
    dados.forEach((t, i) =>
      planes.push({ materiaId: m.id, semana: semanas[Math.min(semanas.length - 1, i * paso)], objetivos: `Que los estudiantes comprendan y apliquen: ${t.titulo.toLowerCase()}.`, actividades: "Presentación del tema, trabajo con material concreto en pequeños grupos, puesta en común y registro en la carpeta.", dictada: true, temaIds: [t.id], creado }),
    );
    const sig = ts[dados.length];
    if (sig && !(m.profesorId === profeDe.get("Matemática") && m.cursoId === cursos[2].id))
      planes.push({ materiaId: m.id, semana: lunes(HOY), objetivos: `Introducir ${sig.titulo.toLowerCase()}.`, actividades: "Exploración inicial con material, guía de preguntas y cierre grupal.", dictada: false, temaIds: [sig.id], creado });
  }
  await db.planificaciones.insertarVarios(planes);

  log("Banco de recursos…");
  const REC = [
    ["Guía de ejercicios: ecuaciones", "guia", 2, "Matemática", 2],
    ["Examen integrador 1er trimestre (modelo)", "examen", 2, "Matemática", 1],
    ["Presentación: funciones lineales", "presentacion", 3, "Matemática", 3],
    ["Guía de lectura: cuentos fantásticos", "guia", 3, "Prácticas del Lenguaje", 1],
    ["Rúbrica de texto argumentativo", "otro", 4, "Prácticas del Lenguaje", 2],
    ["Protocolo de uso del microscopio", "guia", 1, "Biología", 1],
    ["Salida al río Luján: guía de campo", "guia", 1, "Biología", 3],
    ["Presentación: Revolución de Mayo", "presentacion", 2, "Historia", 2],
    ["Mapa político de América del Sur", "otro", 1, "Geografía", 1],
    ["Vocabulary list – Unit 3", "guia", 2, "Inglés", 3],
  ] as const;
  await db.recursos.insertarVarios(
    REC.map(([titulo, tipo, anio, materia, unidad]) => ({
      titulo, tipo, anio, materia, unidad, nivel: "secundaria", descripcion: "Material elaborado por el equipo docente.",
      url: "https://drive.google.com/", archivo: null, archivoNombre: null, soloDocentes: tipo === "examen", autorId: profeDe.get(materia)!, creado,
    })),
  );

  log("Asistencia…");
  let nAsis = 0;
  const asisPorAlumno = new Map<number, Record<string, T.Asistencia>>();
  for (let f = `${ANIO}-03-02`; f < HOY; f = sumar(f, 1)) {
    if (dow(f) > 5 || FERIADOS.has(f) || RECESO(f)) continue;
    for (const a of alumnos) {
      const p = perfil.get(a.id)!;
      const mult = f >= sumar(HOY, -30) && enRiesgo.includes(a) ? 2 : 1;
      const r = rnd();
      const estado: T.EstadoAsistencia = r < p.faltas * mult ? (rnd() < 0.25 ? "justificado" : "ausente") : r < p.faltas * mult + 0.04 ? "tarde" : "presente";
      const reg = asisPorAlumno.get(a.id) ?? {};
      reg[f] = { fecha: f, estado, metodo: rnd() < 0.3 ? "qr" : "manual", tomadaPor: cursos.find((c) => c.id === a.cursoId)!.preceptorId, hora: iso(f, estado === "tarde" ? "07:52" : "07:28") };
      asisPorAlumno.set(a.id, reg);
      nAsis++;
    }
  }
  await Promise.all([...asisPorAlumno].map(([id, r]) => db.asistencia.guardar(id, r)));

  log("Convivencia…");
  const reg = async (al: T.Alumno, v: Partial<T.Convivencia> & Pick<T.Convivencia, "tipo" | "categoria" | "descripcion">, segs: string[] = []) => {
    const autor = v.autorId ?? prec1.id;
    const r = await db.convivencia.insertar({ alumnoId: al.id, gravedad: null, estado: "abierto", visibleFamilia: true, fecha: sumar(HOY, -Math.floor(rnd() * 40)), ...v, autorId: autor });
    if (segs.length) await db.seguimientos.insertarVarios(segs.map((nota, i) => ({ registroId: r.id, autorId: autor, nota, pasoProtocolo: i + 1, creado })));
  };
  await reg(enRiesgo[0], { tipo: "incidente", categoria: "Conflicto entre pares", gravedad: "moderada", descripcion: "Discusión fuerte en el recreo con un compañero, con empujones.", estado: "en_seguimiento", fecha: sumar(HOY, -9) }, ["Se escuchó a ambos por separado.", "Mediación realizada con la tutora."]);
  await reg(enRiesgo[1], { tipo: "incidente", categoria: "Sospecha de acoso escolar", gravedad: "grave", descripcion: "Una compañera refiere mensajes ofensivos reiterados en un grupo del curso.", estado: "en_seguimiento", fecha: sumar(HOY, -5), visibleFamilia: false }, ["Dirección informada el mismo día.", "Se resguardó la identidad de la alumna afectada."]);
  await reg(enRiesgo[2], { tipo: "incidente", categoria: "Llegadas tarde reiteradas", gravedad: "leve", descripcion: "Cinco llegadas tarde en dos semanas.", autorId: prec2.id, fecha: sumar(HOY, -3) });
  await reg(enRiesgo[2], { tipo: "incidente", categoria: "Uso indebido del celular", gravedad: "leve", descripcion: "Uso del celular durante la evaluación de Historia.", autorId: profeDe.get("Historia")!, fecha: sumar(HOY, -15), estado: "cerrado" }, ["Se conversó con el alumno.", "Se avisó a la familia."]);
  await reg(tomas, { tipo: "reconocimiento", categoria: "Compañerismo", descripcion: "Ayudó a organizar el material del laboratorio para todo el curso.", autorId: profeDe.get("Biología")!, estado: "cerrado", fecha: sumar(HOY, -12) });
  await reg(tomas, { tipo: "incidente", categoria: "Uso indebido del celular", gravedad: "leve", descripcion: "Usó el celular en clase de Matemática después de un primer llamado de atención.", autorId: profeDe.get("Matemática")!, estado: "cerrado", fecha: sumar(HOY, -20) }, ["Llamado de atención en clase.", "Aviso a la familia por la app."]);
  await reg(julia, { tipo: "reconocimiento", categoria: "Liderazgo positivo", descripcion: "Coordinó la campaña de reciclaje del ciclo superior.", autorId: directora.id, estado: "cerrado", fecha: sumar(HOY, -7) });
  for (const a of [alumnos[9], alumnos[22], alumnos[35]])
    await reg(a, { tipo: "reconocimiento", categoria: elegir(["Esfuerzo y superación", "Participación en proyectos", "Cuidado del ambiente"]), descripcion: "Destacada participación en la Muestra Anual.", autorId: elegir(profes).id, estado: "cerrado" });

  log("Comunicados…");
  const com = async (v: Omit<T.Comunicado, "id" | "nivel" | "cursoId"> & { cursoId?: number }, pct: number) => {
    const c = await db.comunicados.insertar({ nivel: null, cursoId: null, ...v });
    const alcance = familias.filter((f) => v.destino === "todos" || alumnos.find((a) => a.id === f.alumnoId)?.cursoId === v.cursoId);
    const padres = [...new Set(alcance.map((f) => f.padreId))].filter((id) => id !== familia.id && rnd() < pct);
    await db.lecturas.guardar(
      c.id,
      Object.fromEntries(
        padres.map((padreId) => [padreId, {
          padreId, leido: creado,
          firmado: v.tipo !== "informativo" && rnd() < 0.85 ? creado : null,
          respuesta: v.tipo === "autorizacion" ? (rnd() < 0.92 ? "autorizo" : "no_autorizo") : null,
        } satisfies T.Lectura]),
      ),
    );
  };
  await com({ titulo: "Cierre del ciclo lectivo y Muestra Anual", cuerpo: "Queridas familias:\n\nLes compartimos el cronograma de cierre del año. La Muestra Anual de trabajos será el viernes 4 de diciembre de 9 a 12 h en el SUM y las aulas. Los esperamos para recorrer los proyectos que los chicos y chicas desarrollaron durante el año.\n\nEl último día de clases será el viernes 18 de diciembre.\n\nEquipo directivo", autorId: directora.id, destino: "todos", tipo: "informativo", creado: iso(sumar(HOY, -2), "10:00") }, 0.62);
  await com({ titulo: "Autorización: salida al Complejo Museográfico de Luján", cuerpo: "El 2° año A realizará una salida educativa al Complejo Museográfico Enrique Udaondo en el marco del proyecto de Historia regional. Salimos 8:00 y regresamos 12:30. Costo del micro: $9.500.\n\nPor favor, confirmen la autorización desde la sección Salidas.", autorId: profeDe.get("Historia")!, destino: "curso", cursoId: tomas.cursoId, tipo: "informativo", creado: iso(sumar(HOY, -4), "18:00") }, 0.75);
  await com({ titulo: "Notificación de calificaciones del 2° trimestre", cuerpo: "Ya están disponibles las calificaciones del segundo trimestre en la sección Calificaciones. Les pedimos que confirmen la notificación con la firma digital.", autorId: secretario.id, destino: "todos", tipo: "firma", creado: iso(`${ANIO}-09-05`) }, 0.9);
  await com({ titulo: "Uso de imagen en la Muestra Anual", cuerpo: "Durante la Muestra Anual vamos a sacar fotos para la revista del colegio. Por favor, indiquen si autorizan la publicación de imágenes de su hijo o hija.", autorId: directora.id, destino: "todos", tipo: "autorizacion", creado: iso(sumar(HOY, -3), "12:00") }, 0.55);
  await com({ titulo: "Jornada institucional: no hay clases", cuerpo: "Les recordamos que el lunes 30 de noviembre no habrá clases por jornada de capacitación docente.", autorId: directora.id, destino: "todos", tipo: "informativo", creado: iso(sumar(HOY, -1), "09:00") }, 0.4);

  log("Agenda, calendario y salidas…");
  const tareas: Omit<T.Tarea, "id">[] = [];
  for (const m of materias) {
    if (rnd() < 0.55) tareas.push({ materiaId: m.id, tipo: "tarea", titulo: elegir(["Terminar la guía de ejercicios", "Leer el capítulo y responder las preguntas", "Traer el informe impreso", "Completar el trabajo práctico"]), descripcion: null, fecha: proxHabil(sumar(HOY, 1 + Math.floor(rnd() * 8))), autorId: m.profesorId! });
    if (m.nombre === "Biología" || m.nombre === "Educación Artística") tareas.push({ materiaId: m.id, tipo: "material", titulo: m.nombre === "Biología" ? "Guardapolvo y guantes para laboratorio" : "Témperas, pinceles y hoja canson N° 5", descripcion: null, fecha: proxHabil(sumar(HOY, 2 + Math.floor(rnd() * 5))), autorId: m.profesorId! });
  }
  await db.tareas.insertarVarios(tareas);
  const ev: Omit<T.Evento, "id">[] = [];
  const E = (v: Partial<T.Evento> & Pick<T.Evento, "titulo" | "tipo" | "fecha" | "autorId">) => ev.push({ hora: null, cursoId: null, materiaId: null, descripcion: null, ...v });
  for (const c of cursos) {
    const ms = materias.filter((m) => m.cursoId === c.id && !["Educación Física", "Educación Artística"].includes(m.nombre));
    const d1 = proxHabil(sumar(HOY, 4 + c.anio));
    E({ titulo: `Evaluación de ${ms[0].nombre}`, tipo: "evaluacion", fecha: d1, cursoId: c.id, materiaId: ms[0].id, autorId: ms[0].profesorId! });
    E({ titulo: `Evaluación de ${ms[2].nombre}`, tipo: "evaluacion", fecha: d1, cursoId: c.id, materiaId: ms[2].id, autorId: ms[2].profesorId! });
    E({ titulo: `Trabajo integrador de ${ms[4].nombre}`, tipo: "evaluacion", fecha: proxHabil(sumar(HOY, 1 + c.anio)), cursoId: c.id, materiaId: ms[4].id, autorId: ms[4].profesorId! });
  }
  E({ titulo: "Día de la Soberanía Nacional", tipo: "feriado", fecha: `${ANIO}-11-23`, autorId: directora.id });
  E({ titulo: "Jornada institucional (sin clases)", tipo: "feriado", fecha: `${ANIO}-11-30`, autorId: directora.id });
  E({ titulo: "Muestra Anual de trabajos", tipo: "acto", fecha: `${ANIO}-12-04`, hora: "09:00", descripcion: "SUM y aulas. Abierta a las familias.", autorId: directora.id });
  E({ titulo: "Inmaculada Concepción", tipo: "feriado", fecha: `${ANIO}-12-08`, autorId: directora.id });
  E({ titulo: "Reunión de familias de 4° año", tipo: "reunion", fecha: `${ANIO}-12-10`, hora: "18:00", cursoId: cursos[3].id, autorId: prec2.id });
  E({ titulo: "Acto de fin de año", tipo: "acto", fecha: `${ANIO}-12-17`, hora: "10:00", autorId: directora.id });
  E({ titulo: "Último día de clases", tipo: "otro", fecha: `${ANIO}-12-18`, autorId: directora.id });
  await db.eventos.insertarVarios(ev);

  const salida = async (v: Omit<T.Salida, "id" | "eventoId">, pctResp: number, pctPago: number, excluir?: number) => {
    const e = await db.eventos.insertar({ titulo: `Salida: ${v.titulo}`, tipo: "salida", fecha: v.fecha, hora: v.horaSalida, cursoId: v.cursoId, materiaId: null, descripcion: v.descripcion, autorId: v.autorId });
    const s = await db.salidas.insertar({ ...v, eventoId: e.id });
    const aut: Record<string, T.Autorizacion> = {};
    for (const a of alumnos.filter((x) => x.cursoId === v.cursoId)) {
      const resp = a.id !== excluir && rnd() < pctResp;
      aut[a.id] = { alumnoId: a.id, padreId: resp ? familias.find((f) => f.alumnoId === a.id)!.padreId : null, autorizado: resp ? rnd() < 0.93 : null, firmado: resp ? creado : null, pagado: resp && rnd() < pctPago };
    }
    await db.autorizaciones.guardar(s.id, aut);
  };
  await salida({ titulo: "Complejo Museográfico Enrique Udaondo", destino: "Luján, Buenos Aires", fecha: proxHabil(sumar(HOY, 13)), horaSalida: "08:00", horaRegreso: "12:30", cursoId: tomas.cursoId, costo: 9500, descripcion: "Recorrido por el Museo Colonial y del Transporte, en el marco del proyecto «Luján en la historia regional».", autorId: profeDe.get("Historia")!, responsables: [profeDe.get("Historia")!, prec1.id] }, 0.75, 0.7, tomas.id);
  await salida({ titulo: "Reserva Natural del río Luján", destino: "Luján, Buenos Aires", fecha: proxHabil(sumar(HOY, 6)), horaSalida: "08:30", horaRegreso: "12:00", cursoId: cursos[0].id, costo: 6000, descripcion: "Observación de biodiversidad y toma de muestras para el proyecto ambiental de Biología.", autorId: profeDe.get("Biología")!, responsables: [profeDe.get("Biología")!, prec1.id] }, 0.85, 0.5);

  log("Reuniones…");
  const turnos: Omit<T.Turno, "id">[] = [];
  for (const p of [profes[0], profes[1], profes[4], prec1])
    for (let d = 1; d <= 8; d++) {
      const f = sumar(HOY, d);
      if (dow(f) > 5 || dow(f) % 2 === 0) continue;
      for (const h of ["13:00", "13:20", "13:40"]) turnos.push({ docenteId: p.id, inicio: iso(f, h), minutos: 20, modalidad: h === "13:40" ? "virtual" : "presencial", padreId: null, alumnoId: null, motivo: null, cancelado: false });
    }
  turnos.forEach((t, i) => {
    if (i % 4 !== 1) return;
    const a = elegir(alumnos.filter((x) => x.id !== tomas.id && x.id !== julia.id));
    Object.assign(t, { alumnoId: a.id, padreId: familias.find((f) => f.alumnoId === a.id)!.padreId, motivo: "Consulta sobre el rendimiento del trimestre" });
  });
  await db.turnos.insertarVarios(turnos);

  log("Matrícula…");
  const SOL: [string, string, number, T.EstadoSolicitud, string][] = [
    ["Lola", "Carrizo", 1, "recibida", "Escuela N° 4 de Luján"],
    ["Benicio", "Arias", 1, "en_revision", "Colegio San Luis"],
    ["Emilia", "Toledo", 2, "documentacion_pendiente", "Instituto Del Sol"],
    ["Valentín", "Ponce", 1, "entrevista", "Escuela Montessori de Mercedes"],
    ["Juana", "Maidana", 3, "aceptada", "E.E.S. N° 2"],
  ];
  for (const [i, [n, a, anio, estado, esc]] of SOL.entries()) {
    const codigo = `M${ANIO + 1}-${101 + i}`;
    const s = await db.solicitudes.insertar({
      codigo, tipo: "nueva", padreId: null, alumnoId: null, alumnoNombre: n, alumnoApellido: a, alumnoDni: String(52300100 + i * 17),
      alumnoFechaNac: `${ANIO - 12 - anio}-0${1 + i}-1${i}`, nivel: "secundaria", anio, cicloLectivo: ANIO + 1,
      tutorNombre: `${ADULTOS[i]} ${a}`, tutorEmail: `${ADULTOS[i].toLowerCase()}.${a.toLowerCase()}@correo.demo`, tutorTelefono: `11 4000-${1200 + i}`,
      escuelaAnterior: esc, comentarios: null, estado, observaciones: estado === "documentacion_pendiente" ? "Falta el certificado de vacunación." : null,
      documentos: [], creado: iso(sumar(HOY, -20 + i * 3), "11:00"),
    });
    await db.indexarSolicitud(codigo, s.id);
  }
  for (const a of [alumnos[2], alumnos[14]]) {
    const codigo = `R${ANIO + 1}-${a.id}`;
    const s = await db.solicitudes.insertar({
      codigo, tipo: "reinscripcion", padreId: familias.find((f) => f.alumnoId === a.id)!.padreId, alumnoId: a.id, alumnoNombre: a.nombre, alumnoApellido: a.apellido, alumnoDni: a.dni,
      alumnoFechaNac: a.fechaNac, nivel: "secundaria", anio: cursos.find((c) => c.id === a.cursoId)!.anio + 1, cicloLectivo: ANIO + 1, tutorNombre: "Familia", tutorEmail: `familia${a.id}@cuaderno.demo`,
      tutorTelefono: "11 5555-0000", escuelaAnterior: null, comentarios: null, estado: "aceptada", observaciones: null, documentos: [], creado,
    });
    await db.indexarSolicitud(codigo, s.id);
  }

  log("Cuotas y becas…");
  const becados = [
    { a: alumnos[3], p: 50, m: "Hermanos en la institución" },
    { a: alumnos[20], p: 25, m: "Beca por situación económica" },
    { a: alumnos[33], p: 100, m: "Hijo/a de personal docente" },
    { a: julia, p: 15, m: "Descuento por hermanos" },
  ];
  await db.becas.insertarVarios(becados.map((b) => ({ alumnoId: b.a.id, porcentaje: b.p, motivo: b.m, vigente: true })));
  const MONTO = 215000;
  const morosos = new Set([alumnos[5].id, alumnos[17].id, alumnos[28].id, alumnos[40].id]);
  await Promise.all(
    alumnos.map((a) => {
      const reg: Record<string, T.Cuota> = {};
      const b = becados.find((x) => x.a.id === a.id);
      const descuento = b ? Math.round((MONTO * b.p) / 100) : 0;
      for (let mes = 3; mes <= 12; mes++) {
        const periodo = `${ANIO}-${String(mes).padStart(2, "0")}`;
        const venc = `${periodo}-10`;
        const debe = (morosos.has(a.id) && mes >= 9) || (a.id === tomas.id && mes === 11);
        const paga = venc < HOY && !debe;
        reg[claveCuota(periodo, "Cuota mensual")] = {
          alumnoId: a.id, periodo, concepto: "Cuota mensual", montoBase: MONTO, descuento, vencimiento: venc,
          pagada: descuento >= MONTO ? iso(`${periodo}-01`) : paga ? iso(`${periodo}-0${1 + Math.floor(rnd() * 9)}`) : null,
          medio: descuento >= MONTO ? "Beca" : paga ? elegir(["Transferencia", "Débito automático", "Mercado Pago", "Efectivo en secretaría"]) : null,
        };
      }
      return db.cuotas.guardar(a.id, reg);
    }),
  );

  log("Inventario, reservas y reemplazos…");
  const esp = await db.espacios.insertarVarios([
    { nombre: "Laboratorio de Ciencias", tipo: "espacio", categoria: "Laboratorio", cantidad: 1, ubicacion: "Planta baja", estado: "disponible" },
    { nombre: "Gimnasio", tipo: "espacio", categoria: "Deportes", cantidad: 1, ubicacion: "Patio posterior", estado: "disponible" },
    { nombre: "SUM", tipo: "espacio", categoria: "Salón", cantidad: 1, ubicacion: "Planta baja", estado: "disponible" },
    { nombre: "Biblioteca", tipo: "espacio", categoria: "Biblioteca", cantidad: 1, ubicacion: "Primer piso", estado: "disponible" },
    { nombre: "Sala de informática", tipo: "espacio", categoria: "Tecnología", cantidad: 1, ubicacion: "Primer piso", estado: "disponible" },
    { nombre: "Proyector Epson (1)", tipo: "equipo", categoria: "Proyector", cantidad: 1, ubicacion: "Preceptoría", estado: "disponible" },
    { nombre: "Proyector Epson (2)", tipo: "equipo", categoria: "Proyector", cantidad: 1, ubicacion: "Preceptoría", estado: "en_reparacion" },
    { nombre: "Carro de notebooks", tipo: "equipo", categoria: "Computadoras", cantidad: 25, ubicacion: "Sala de informática", estado: "disponible" },
    { nombre: "Parlante portátil", tipo: "equipo", categoria: "Audio", cantidad: 2, ubicacion: "Dirección", estado: "disponible" },
    { nombre: "Kit de robótica educativa", tipo: "equipo", categoria: "Tecnología", cantidad: 6, ubicacion: "Sala de informática", estado: "disponible" },
    { nombre: "Microscopios", tipo: "equipo", categoria: "Laboratorio", cantidad: 12, ubicacion: "Laboratorio", estado: "disponible" },
  ]);
  await db.reservas.insertarVarios([
    { espacioId: esp[2].id, usuarioId: directora.id, fecha: `${ANIO}-12-04`, moduloDesde: 1, moduloHasta: 7, motivo: "Muestra Anual" },
    { espacioId: esp[5].id, usuarioId: profeDe.get("Historia")!, fecha: proxHabil(sumar(HOY, 1)), moduloDesde: 3, moduloHasta: 4, motivo: "Presentación de la unidad 3" },
    { espacioId: esp[7].id, usuarioId: profeDe.get("Matemática")!, fecha: proxHabil(sumar(HOY, 1)), moduloDesde: 5, moduloHasta: 6, motivo: "Trabajo con GeoGebra" },
    { espacioId: esp[3].id, usuarioId: profeDe.get("Prácticas del Lenguaje")!, fecha: proxHabil(sumar(HOY, 2)), moduloDesde: 1, moduloHasta: 2, motivo: "Hora de lectura" },
  ]);
  await db.ausenciasDocentes.insertar({ profesorId: profeDe.get("Prácticas del Lenguaje")!, fecha: proxHabil(HOY), motivo: "Licencia por enfermedad", registradoPor: secretario.id });

  log("Avisos…");
  const aviso = async (uid: number, titulo: string, cuerpo: string, link: string, tipo: string) => {
    const id = await db.siguienteId("avisos");
    await db.avisos.guardar(uid, { [id]: { id, titulo, cuerpo, link, tipo, leida: false, creado } });
  };
  await aviso(familia.id, "Tomás tiene una cuota vencida", "La cuota de noviembre venció el 10/11.", "/pagos", "pago");
  await aviso(familia.id, "Nueva autorización para firmar", "Salida al Complejo Museográfico de Luján (2° A).", "/salidas", "autorizacion");
  await aviso(familia.id, "Reconocimiento para Julia", "Liderazgo positivo: coordinó la campaña de reciclaje.", "/convivencia", "convivencia");
  await aviso(profeDe.get("Matemática")!, "Planificación pendiente", "Todavía no cargaste la planificación de esta semana para 3° A.", "/planificacion", "info");
  await aviso(directora.id, "Nueva solicitud de matrícula", "Lola Carrizo — 1° año.", "/matricula", "matricula");

  // Ajustes del colegio de ejemplo: ciclo en curso y tercer trimestre
  await kv.set("cd:config:ajustes", JSON.stringify({ reglas: { cicloLectivo: ANIO, trimestreActual: 3 } }));

  return { alumnos: alumnos.length, materias: materias.length, asistencias: nAsis };
}
