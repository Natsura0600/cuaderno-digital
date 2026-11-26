"use server";

import { revalidatePath } from "next/cache";
import { db, kv } from "@/db";
import { requerir } from "@/lib/auth";
import { guardarAjustes } from "@/lib/ajustes";
import { REGLAS, type Modulo } from "@/lib/config";
import type { Resultado } from "@/components/formularios";

const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));

export async function guardarReglas(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const r = {
    cicloLectivo: num(fd, "cicloLectivo"),
    trimestreActual: num(fd, "trimestreActual"),
    notaAprobacion: num(fd, "notaAprobacion"),
    maxEvaluacionesPorDia: num(fd, "maxEvaluacionesPorDia"),
    limiteInasistencias: num(fd, "limiteInasistencias"),
    avisoInasistencias: num(fd, "avisoInasistencias"),
    valorTarde: num(fd, "valorTarde"),
    horaTarde: String(fd.get("horaTarde") ?? ""),
  };
  if (!(r.cicloLectivo >= 2020 && r.cicloLectivo <= 2100)) return { ok: false, msg: "Revisá el ciclo lectivo." };
  if (![1, 2, 3].includes(r.trimestreActual)) return { ok: false, msg: "El trimestre va de 1 a 3." };
  if (!(r.notaAprobacion >= 1 && r.notaAprobacion <= 10)) return { ok: false, msg: "La nota de aprobación va de 1 a 10." };
  if (!(r.maxEvaluacionesPorDia >= 1 && r.maxEvaluacionesPorDia <= 10)) return { ok: false, msg: "Revisá el máximo de evaluaciones por día." };
  if (!(r.limiteInasistencias > 0 && r.avisoInasistencias > 0 && r.avisoInasistencias <= r.limiteInasistencias)) return { ok: false, msg: "El aviso de inasistencias tiene que ser menor o igual al tope." };
  if (![0.25, 0.5, 1].includes(r.valorTarde)) return { ok: false, msg: "Elegí cuánto suma una llegada tarde." };
  if (!/^\d{2}:\d{2}$/.test(r.horaTarde)) return { ok: false, msg: "Indicá la hora de tolerancia para llegadas tarde." };
  await guardarAjustes({ reglas: r });
  revalidatePath("/", "layout");
  return { ok: true, msg: "Configuración guardada." };
}

export async function guardarModulos(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const lineas = String(fd.get("modulos") ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const modulos: Modulo[] = [];
  for (const [i, l] of lineas.entries()) {
    const m = l.match(/^(\d{1,2})[:.](\d{2})\s*[-–a]+\s*(\d{1,2})[:.](\d{2})$/);
    if (!m) return { ok: false, msg: `La línea ${i + 1} («${l}») no tiene el formato 07:30-08:10.` };
    const desde = `${m[1].padStart(2, "0")}:${m[2]}`;
    const hasta = `${m[3].padStart(2, "0")}:${m[4]}`;
    if (hasta <= desde) return { ok: false, msg: `En la línea ${i + 1} el módulo termina antes de empezar.` };
    if (modulos.length && desde < modulos[modulos.length - 1].hasta) return { ok: false, msg: `El módulo ${i + 1} empieza antes de que termine el anterior.` };
    modulos.push({ n: i + 1, desde, hasta });
  }
  if (modulos.length < 2 || modulos.length > 12) return { ok: false, msg: "Cargá entre 2 y 12 módulos." };
  await guardarAjustes({ modulos });
  revalidatePath("/", "layout");
  const fuera = (await db.horarios.todos((h) => h.modulo > modulos.length)).length;
  return { ok: true, msg: `Horario escolar guardado: ${modulos.length} módulos por día.${fuera ? ` Hay ${fuera} clases en módulos que ya no existen: generá de nuevo los horarios.` : ""}` };
}

/**
 * Cierra el ciclo lectivo: guarda las notas del año en el historial, pasa a cada alumno
 * al curso del año siguiente (misma división y nivel) y da por egresados a los del último año.
 */
export async function cerrarCiclo(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  if (String(fd.get("confirmacion") ?? "").trim().toUpperCase() !== "CERRAR") return { ok: false, msg: "Para confirmar, escribí CERRAR." };
  const repiten = new Set(fd.getAll("repiten").map(Number));
  const ciclo = REGLAS.cicloLectivo;
  const [cursos, alumnos, planes] = await Promise.all([db.cursos.todos(), db.alumnos.todos((a) => a.activo), db.planificaciones.todos()]);
  const ultimoAnio = (nivel: string) => Math.max(...cursos.filter((c) => c.nivel === nivel).map((c) => c.anio));
  let promovidos = 0;
  let egresados = 0;
  const sinCurso: string[] = [];
  for (const a of alumnos) {
    // Historial de notas del ciclo
    const notas = await kv.hgetall(`cd:notas:${a.id}`);
    if (Object.keys(notas).length) {
      await kv.hset(`cd:hist:${ciclo}:notas:${a.id}`, notas);
      await kv.hset(`cd:hist:${ciclo}:curso`, { [a.id]: String(a.cursoId) });
      await kv.del([`cd:notas:${a.id}`]);
    }
    if (repiten.has(a.id)) continue;
    const c = cursos.find((x) => x.id === a.cursoId);
    if (!c) continue;
    let sig = cursos.find((x) => x.nivel === c.nivel && x.anio === c.anio + 1 && x.division === c.division);
    if (c.anio >= ultimoAnio(c.nivel)) {
      // Último año del nivel: pasa al primer año del nivel siguiente si el colegio lo tiene; si no, egresa
      const siguienteNivel = c.nivel === "inicial" ? "primaria" : c.nivel === "primaria" ? "secundaria" : null;
      const delNivel = cursos.filter((x) => x.nivel === siguienteNivel);
      const primero = delNivel.length ? Math.min(...delNivel.map((x) => x.anio)) : null;
      sig = delNivel.find((x) => x.anio === primero && x.division === c.division) ?? delNivel.find((x) => x.anio === primero);
      if (!sig) {
        await db.alumnos.actualizar(a.id, { activo: false });
        egresados++;
        continue;
      }
    }
    if (!sig) {
      sinCurso.push(`${a.apellido}, ${a.nombre} (${c.nombre})`);
      continue;
    }
    await db.alumnos.actualizar(a.id, { cursoId: sig.id });
    promovidos++;
  }
  // El avance curricular empieza de cero (el programa de cada materia se conserva)
  await db.planificaciones.borrar(planes.map((p) => p.id));
  await guardarAjustes({ reglas: { cicloLectivo: ciclo + 1, trimestreActual: 1 } });
  revalidatePath("/", "layout");
  return {
    ok: true,
    msg: `Ciclo ${ciclo} cerrado. ${promovidos} alumnos pasaron de año, ${egresados} egresaron y ${repiten.size} repiten. Ahora el ciclo vigente es ${ciclo + 1}.${sinCurso.length ? ` No hay curso siguiente para: ${sinCurso.slice(0, 8).join("; ")}${sinCurso.length > 8 ? "…" : ""}. Crealo en Comunidad y movelos a mano.` : ""}`,
  };
}
