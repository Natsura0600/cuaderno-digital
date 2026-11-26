import Link from "next/link";
import { db, kv } from "@/db";
import { requerir, type Usuario } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe, nombreCompleto, todasLasMaterias, todosLosAlumnos, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { calcularAlertas } from "@/lib/alertas";
import { DIAS, MODULOS, REGLAS } from "@/lib/config";
import {
  boletin, comunicadosParaPadre, cuotasPendientes, eventosEntre, porcentajeAsistencia, promediosPorCursoMateria, resumenAsistencia, tareasDeCurso,
} from "@/lib/consultas";
import { diaSemana, fCorta, fDia, fFechaHora, fLarga, hoy, lunesDe, pesos, sumarDias } from "@/lib/fechas";
import { fmtNota } from "@/lib/notas";
import { modulosSinCubrir } from "@/lib/reemplazos";
import { Aviso, Chip, Dato, Encabezado, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { ChipEvento } from "@/components/eventos";

export const metadata = { title: "Inicio" };

export default async function Inicio({ searchParams }: PageProps<"/inicio">) {
  const u = await requerir();
  const sp = await searchParams;
  return (
    <>
      {sp["sin-permiso"] && <div className="mb-4"><Aviso tono="aviso">Esa sección no está disponible para tu perfil.</Aviso></div>}
      {u.rol === "padre" && <InicioFamilia u={u} />}
      {u.rol === "profesor" && <InicioDocente u={u} />}
      {u.rol === "preceptor" && <InicioPreceptor u={u} />}
      {u.rol === "directivo" && <InicioDirectivo u={u} />}
    </>
  );
}

function saludo(u: Usuario) {
  const h = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  return `${h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches"}, ${u.nombre}`;
}

/* ───────────── Familia ───────────── */
async function InicioFamilia({ u }: { u: Usuario }) {
  const hijos = await hijosDe(u.id);
  const ids = hijos.map((h) => h.id);
  const cursoIds = [...new Set(hijos.map((h) => h.cursoId))];
  const [asis, coms, deuda, evs, tar, boletines, salidas] = await Promise.all([
    resumenAsistencia(ids),
    comunicadosParaPadre(u.id),
    cuotasPendientes(ids),
    eventosEntre(cursoIds, hoy(), sumarDias(hoy(), 7)),
    tareasDeCurso(cursoIds, hoy(), sumarDias(hoy(), 7)),
    Promise.all(ids.map((id) => boletin(id))),
    db.salidas.todos((s) => cursoIds.includes(s.cursoId) && s.fecha >= hoy()),
  ]);
  const autPend: { salida: string; alumno: string; key: string }[] = [];
  for (const s of salidas) {
    const auts = await db.autorizaciones.todos(s.id);
    for (const h of hijos) if (h.cursoId === s.cursoId && !auts[h.id]?.firmado) autPend.push({ salida: s.titulo, alumno: h.nombre, key: `${s.id}-${h.id}` });
  }
  const pendientes = coms.filter((c) => !c.lectura || (c.tipo !== "informativo" && !c.lectura.firmado));
  const vencidas = deuda.filter((c) => c.vencimiento < hoy());
  const agenda = [
    ...evs.map((e) => ({ k: `e${e.id}`, fecha: e.fecha, txt: e.titulo, sub: e.curso ?? "Todo el colegio", tipo: e.tipo as string })),
    ...tar.map((t) => ({ k: `t${t.id}`, fecha: t.fecha, txt: `${t.materia}: ${t.titulo}`, sub: hijos.filter((h) => h.cursoId === t.cursoId).map((h) => h.nombre).join(", "), tipo: t.tipo as string })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <>
      <Encabezado titulo={saludo(u)} bajada={`${fLarga(hoy())}. Esto es lo que pasa esta semana en el colegio.`} />

      {(vencidas.length > 0 || autPend.length > 0 || pendientes.length > 0) && (
        <div className="mb-6 grid gap-2">
          {autPend.map((a) => (
            <Link key={a.key} href="/salidas" className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-semibold text-warn hover:underline">
              Falta tu autorización: {a.salida} ({a.alumno}) →
            </Link>
          ))}
          {pendientes.length > 0 && (
            <Link href="/comunicados" className="rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info hover:underline">
              Tenés {pendientes.length} comunicado{pendientes.length > 1 ? "s" : ""} sin leer o sin firmar →
            </Link>
          )}
          {vencidas.length > 0 && (
            <Link href="/pagos" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad hover:underline">
              Hay {vencidas.length} cuota{vencidas.length > 1 ? "s" : ""} vencida{vencidas.length > 1 ? "s" : ""} por {pesos(vencidas.reduce((s, c) => s + c.montoBase - c.descuento, 0))} →
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {hijos.map((h, i) => {
          const a = asis.get(h.id)!;
          const b = boletines[i];
          const proms = b.map((m) => m.promedios[REGLAS.trimestreActual - 1]).filter((x): x is number => x !== null);
          const general = proms.length ? Math.round((proms.reduce((s, x) => s + x, 0) / proms.length) * 10) / 10 : null;
          const bajas = b.filter((m) => {
            const p = m.promedios[REGLAS.trimestreActual - 1];
            return p !== null && p < REGLAS.notaAprobacion;
          });
          return (
            <Seccion key={h.id} titulo={<span>{h.nombre} <span className="font-normal text-muted">· {h.curso}</span></span>}>
              <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="eyebrow">Faltas</p>
                  <p className={`tabular mt-1 font-display text-2xl font-bold ${a.faltas >= REGLAS.avisoInasistencias ? "text-warn" : ""}`}>{fmtNota(a.faltas)}</p>
                  <p className="text-xs text-muted">de {REGLAS.limiteInasistencias}</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="eyebrow">Promedio</p>
                  <p className={`tabular mt-1 font-display text-2xl font-bold ${general !== null && general < REGLAS.notaAprobacion ? "text-bad" : ""}`}>{fmtNota(general)}</p>
                  <p className="text-xs text-muted">{REGLAS.trimestreActual}° trimestre</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="eyebrow">Tardes</p>
                  <p className="tabular mt-1 font-display text-2xl font-bold">{a.tardes}</p>
                  <p className="text-xs text-muted">en el año</p>
                </div>
              </div>
              {bajas.length > 0 && (
                <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                  Necesita apoyo en <strong>{bajas.map((m) => m.nombre).join(", ")}</strong>.{" "}
                  <Link className="underline" href="/reuniones">Pedir una reunión</Link>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/calificaciones?hijo=${h.id}`} className="btn-sec btn-chico">Ver boletín</Link>
                <Link href={`/asistencia?hijo=${h.id}`} className="btn-sec btn-chico">Asistencia</Link>
                <Link href={`/asistencia/credencial?hijo=${h.id}`} className="btn-sec btn-chico">Credencial QR</Link>
              </div>
            </Seccion>
          );
        })}
        {hijos.length === 0 && <Vacio titulo="Todavía no hay alumnos vinculados a tu cuenta">Pedile a secretaría que vincule a tus hijos con tu e-mail.</Vacio>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Próximos 7 días" acciones={<Link className="link text-sm" href="/agenda">Agenda completa</Link>}>
          {agenda.length === 0 ? (
            <Vacio titulo="Semana tranquila">No hay tareas ni evaluaciones cargadas.</Vacio>
          ) : (
            <ul className="divide-y divide-line">
              {agenda.map((x) => (
                <li key={x.k} className="flex items-start gap-3 py-2.5">
                  <span className="tabular w-14 shrink-0 text-sm font-semibold text-muted">{fDia(x.fecha)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{x.txt}</span>
                    <span className="block text-xs text-muted">{x.sub}</span>
                  </span>
                  <ChipEvento tipo={x.tipo} />
                </li>
              ))}
            </ul>
          )}
        </Seccion>
        <Seccion titulo="Comunicados recientes" acciones={<Link className="link text-sm" href="/comunicados">Ver todos</Link>}>
          <ul className="divide-y divide-line">
            {coms.slice(0, 4).map((c) => (
              <li key={c.id} className="py-2.5">
                <Link href={`/comunicados/${c.id}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className={`block text-sm ${c.lectura ? "" : "font-bold"}`}>{c.titulo}</span>
                    <span className="block text-xs text-muted">{c.autor} · {fFechaHora(new Date(c.creado))}</span>
                  </span>
                  {!c.lectura ? <Chip tono="info">Nuevo</Chip> : c.tipo !== "informativo" && !c.lectura.firmado ? <Chip tono="aviso">Firmar</Chip> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </>
  );
}

/* ───────────── Docente ───────────── */
async function InicioDocente({ u }: { u: Usuario }) {
  const d = diaSemana(hoy());
  const [mats, cs, hs, aulas, planes, turnos, als] = await Promise.all([
    todasLasMaterias(), todosLosCursos(), db.horarios.todos(), db.aulas.todos(), db.planificaciones.todos((p) => p.semana === lunesDe(hoy())),
    db.turnos.todos((t) => t.docenteId === u.id && !t.cancelado && t.alumnoId !== null && t.inicio >= new Date().toISOString()), todosLosAlumnos(),
  ]);
  const misMaterias = mats.filter((m) => m.profesorId === u.id);
  const clases = hs
    .filter((h) => h.dia === d && misMaterias.some((m) => m.id === h.materiaId))
    .sort((a, b) => a.modulo - b.modulo)
    .map((h) => ({ ...h, materia: mats.find((m) => m.id === h.materiaId)!.nombre, curso: cs.find((c) => c.id === h.cursoId)!.nombre, aula: aulas.find((a) => a.id === h.aulaId)?.nombre ?? "" }));
  const sinPlan = misMaterias.filter((m) => !planes.some((p) => p.materiaId === m.id));
  const cursoIds = (await cursosDe(u)).map((c) => c.id);
  const evs = (await eventosEntre(cursoIds, hoy(), sumarDias(hoy(), 14))).filter((e) => e.tipo === "evaluacion" && e.autorId === u.id);

  return (
    <>
      <Encabezado titulo={saludo(u)} bajada={`${fLarga(hoy())} · ${u.cargo ?? ""}`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Seccion titulo={d > 5 ? "Hoy no hay clases" : `Tus clases de hoy (${DIAS[d]})`} acciones={<Link href="/horarios" className="link text-sm">Horario semanal</Link>}>
          {clases.length === 0 ? (
            <Vacio titulo="Hoy no tenés clases" />
          ) : (
            <ol className="grid gap-2">
              {clases.map((c) => {
                const m = MODULOS[c.modulo - 1];
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className="tabular w-[5.5rem] shrink-0 text-sm text-muted">{m.desde}–{m.hasta}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.curso} · {c.materia}</span>
                      <span className="block text-xs text-muted">{c.aula}</span>
                    </span>
                    <Link href={`/calificaciones/${c.materiaId}`} className="btn-sec btn-chico">Notas</Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Seccion>
        <div className="grid content-start gap-4">
          <Seccion titulo="Pendientes">
            <ul className="grid gap-2 text-sm">
              {sinPlan.length > 0 ? (
                <li className="rounded-xl bg-warn-soft px-3 py-2 text-warn">
                  Falta la planificación de esta semana para {sinPlan.map((m) => `${m.nombre} ${cs.find((c) => c.id === m.cursoId)?.nombre}`).join(", ")}.{" "}
                  <Link className="font-semibold underline" href="/planificacion">Cargar</Link>
                </li>
              ) : (
                <li className="rounded-xl bg-ok-soft px-3 py-2 text-ok">Planificaciones de la semana al día.</li>
              )}
              {evs.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 rounded-xl border border-line px-3 py-2">
                  <span>{e.titulo} · {e.curso}</span>
                  <span className="tabular text-muted">{fDia(e.fecha)}</span>
                </li>
              ))}
            </ul>
          </Seccion>
          <Seccion titulo="Reuniones con familias" acciones={<Link href="/reuniones" className="link text-sm">Gestionar</Link>}>
            {turnos.length === 0 ? (
              <p className="text-sm text-muted">No tenés reuniones reservadas.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {turnos.sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 5).map((t) => (
                  <li key={t.id} className="flex flex-wrap justify-between gap-x-2">
                    <span><strong>{nombreCompleto(als.find((a) => a.id === t.alumnoId))}</strong> <span className="text-muted">· {t.motivo}</span></span>
                    <span className="tabular shrink-0 text-muted">{fFechaHora(new Date(t.inicio))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </div>
    </>
  );
}

/* ───────────── Preceptoría ───────────── */
async function InicioPreceptor({ u }: { u: Usuario }) {
  const cs = await cursosDe(u);
  const ids = cs.map((c) => c.id);
  const als = await alumnosDeCursos(ids);
  const [hoyAsis, alertas, conv, sinCubrir] = await Promise.all([
    Promise.all(als.map((a) => db.asistencia.campo(a.id, hoy()))),
    calcularAlertas(ids),
    db.convivencia.todos((c) => c.tipo === "incidente" && c.estado !== "cerrado"),
    modulosSinCubrir(hoy(), ids),
  ]);
  const abiertos = conv.filter((c) => als.some((a) => a.id === c.alumnoId));
  return (
    <>
      <Encabezado titulo={saludo(u)} bajada={`${fLarga(hoy())} · ${cs.map((c) => c.nombre).join(", ")}`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {cs.map((c) => {
          const delCurso = als.map((a, i) => ({ a, r: hoyAsis[i] })).filter((x) => x.a.cursoId === c.id);
          const tomadas = delCurso.filter((x) => x.r).length;
          const aus = delCurso.filter((x) => x.r?.estado === "ausente").length;
          return (
            <Link key={c.id} href={`/asistencia?curso=${c.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-5 transition hover:border-brand">
              <div>
                <p className="font-display text-2xl font-bold">{c.nombre}</p>
                <p className="text-sm text-muted">{delCurso.length} alumnos · turno {c.turno}</p>
              </div>
              {tomadas >= delCurso.length && delCurso.length > 0 ? <Chip tono="ok">Tomada · {aus} ausentes</Chip> : <span className="btn-prim">Tomar asistencia</span>}
            </Link>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Seccion titulo="Alertas tempranas" acciones={<Link className="link text-sm" href="/alertas">Ver panel</Link>}>
          {alertas.length === 0 ? <p className="text-sm text-muted">Sin alertas.</p> : (
            <ul className="grid gap-2 text-sm">
              {alertas.slice(0, 5).map((a) => (
                <li key={a.alumnoId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{a.nombre} <span className="text-muted">· {a.curso}</span></span>
                  <Chip tono={a.nivel === "alta" ? "peligro" : "aviso"}>{a.nivel}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
        <Seccion titulo="Casos abiertos" acciones={<Link className="link text-sm" href="/convivencia">Bitácora</Link>}>
          {abiertos.length === 0 ? <p className="text-sm text-muted">No hay casos abiertos.</p> : (
            <ul className="grid gap-2 text-sm">
              {abiertos.map((c) => (
                <li key={c.id}>
                  <Link href={`/convivencia/${c.id}`} className="flex items-center justify-between gap-2 hover:underline">
                    <span className="min-w-0 truncate">{nombreCompleto(als.find((a) => a.id === c.alumnoId))} · {c.categoria}</span>
                    <Chip tono={c.gravedad === "grave" ? "peligro" : c.gravedad === "moderada" ? "aviso" : "neutro"}>{c.gravedad}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
        <Seccion titulo="Docentes ausentes hoy" acciones={<Link className="link text-sm" href="/reemplazos">Reemplazos</Link>}>
          {sinCubrir.length === 0 ? <p className="text-sm text-muted">No hay módulos sin cubrir.</p> : (
            <ul className="grid gap-2 text-sm">
              {sinCubrir.map((x) => (
                <li key={x.horarioId} className="rounded-xl bg-warn-soft px-3 py-2 text-warn">{x.curso} · módulo {x.modulo} ({x.materia}) sin cubrir</li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </>
  );
}

/* ───────────── Directivos ───────────── */
async function InicioDirectivo({ u }: { u: Usuario }) {
  const cs = await todosLosCursos();
  const ids = cs.map((c) => c.id);
  const als = await todosLosAlumnos();
  const [asis30, alertas, proms, sinCubrir, evs, conv, deudas, sols, us] = await Promise.all([
    porcentajeAsistencia(ids, sumarDias(hoy(), -30)),
    calcularAlertas(ids),
    promediosPorCursoMateria(REGLAS.trimestreActual),
    modulosSinCubrir(hoy(), null),
    eventosEntre("todos", hoy(), sumarDias(hoy(), 21)),
    db.convivencia.todos((c) => c.tipo === "incidente" && c.estado !== "cerrado"),
    cuotasPendientes(als.map((a) => a.id)),
    db.solicitudes.todos((s) => s.estado === "recibida" || s.estado === "en_revision"),
    todosLosUsuarios(),
  ]);
  const vencidas = deudas.filter((c) => c.vencimiento < hoy());
  const deuda = vencidas.reduce((s, c) => s + c.montoBase - c.descuento, 0);
  const morosos = new Set(vencidas.map((c) => c.alumnoId)).size;
  const materiasNombres = [...new Set(proms.map((p) => p.materia))];
  const docentes = us.filter((x) => x.rol === "profesor").length;

  return (
    <>
      <Encabezado titulo={saludo(u)} bajada={`${fLarga(hoy())} · ${als.length} alumnos, ${docentes} docentes, ${cs.length} cursos`} />
      <PrimerosPasos />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Asistencia (30 días)" valor={asis30 !== null ? `${String(asis30).replace(".", ",")} %` : "—"} tono={asis30 !== null && asis30 < 90 ? "aviso" : "ok"} />
        <Dato etiqueta="Alumnos en alerta" valor={alertas.length} detalle={`${alertas.filter((a) => a.nivel === "alta").length} con prioridad alta`} tono={alertas.some((a) => a.nivel === "alta") ? "peligro" : undefined} />
        <Dato etiqueta="Convivencia" valor={conv.length} detalle="casos abiertos" />
        <Dato etiqueta="Cuotas vencidas" valor={pesos(deuda)} detalle={`${morosos} alumnos`} tono={deuda > 0 ? "aviso" : "ok"} />
      </div>

      {(sinCubrir.length > 0 || sols.length > 0) && (
        <div className="mt-4 grid gap-2">
          {sinCubrir.length > 0 && <Link href="/reemplazos" className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn hover:underline">Hoy hay {sinCubrir.length} módulos sin cubrir por ausencia docente →</Link>}
          {sols.length > 0 && <Link href="/matricula" className="rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info hover:underline">{sols.length} solicitudes de matrícula para revisar →</Link>}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Seccion titulo={`Rendimiento por curso y materia · ${REGLAS.trimestreActual}° trimestre`} acciones={<Link className="link text-sm" href="/calificaciones">Detalle</Link>}>
          {proms.every((x) => x.prom === null) ? (
            <Vacio titulo={`Todavía no hay notas del ${REGLAS.trimestreActual}° trimestre`}>Cuando los docentes carguen calificaciones, acá vas a ver el promedio de cada materia por curso.</Vacio>
          ) : (
          <TablaScroll>
            <table className="tabla tabular">
              <thead>
                <tr>
                  <th>Materia</th>
                  {cs.map((c) => <th key={c.id} className="!text-center">{c.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {materiasNombres.map((m) => (
                  <tr key={m}>
                    <td className="whitespace-nowrap font-medium">{m}</td>
                    {cs.map((c) => {
                      const p = proms.find((x) => x.materia === m && x.cursoId === c.id)?.prom ?? null;
                      const cls = p === null ? "" : p < REGLAS.notaAprobacion ? "bg-bad-soft text-bad" : p < 7.5 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
                      return <td key={c.id} className="!text-center"><span className={`inline-block min-w-12 rounded-lg px-2 py-0.5 font-semibold ${cls}`}>{fmtNota(p)}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
          )}
        </Seccion>
        <div className="grid content-start gap-4">
          <Seccion titulo="Prioridad alta" acciones={<Link className="link text-sm" href="/alertas">Panel de alertas</Link>}>
            {alertas.filter((a) => a.nivel === "alta").length === 0 ? <p className="text-sm text-muted">Nadie en prioridad alta.</p> : (
              <ul className="grid gap-3 text-sm">
                {alertas.filter((a) => a.nivel === "alta").map((a) => (
                  <li key={a.alumnoId}>
                    <p className="font-semibold">{a.nombre} <span className="font-normal text-muted">· {a.curso}</span></p>
                    <p className="text-muted">{a.motivos.map((m) => m.texto).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
          <Seccion titulo="Próximas fechas" acciones={<Link className="link text-sm" href="/calendario">Calendario</Link>}>
            {evs.filter((e) => e.tipo !== "evaluacion").length === 0 && <p className="text-sm text-muted">No hay actos, salidas ni feriados cargados para las próximas semanas.</p>}
            <ul className="grid gap-2 text-sm">
              {evs.filter((e) => e.tipo !== "evaluacion").slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="tabular w-14 shrink-0 font-semibold text-muted">{fCorta(e.fecha)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.titulo}</span>
                  <ChipEvento tipo={e.tipo} />
                </li>
              ))}
            </ul>
          </Seccion>
        </div>
      </div>
    </>
  );
}

/* Lista de primeros pasos para un colegio que recién empieza a cargar datos */
async function PrimerosPasos() {
  const [cs, us, mats, hs, als, fams, ajustes] = await Promise.all([
    todosLosCursos(), todosLosUsuarios(), todasLasMaterias(), db.horarios.todos(), todosLosAlumnos(), db.familias.todos(), kv.get("cd:config:ajustes"),
  ]);
  const profes = us.filter((x) => x.rol === "profesor" && x.activo);
  const sinDocente = mats.filter((m) => !m.profesorId).length;
  const conFamilia = new Set(fams.map((f) => f.alumnoId));
  const sinFamilia = als.filter((a) => !conFamilia.has(a.id)).length;
  const sinPrec = cs.filter((c) => !c.preceptorId).length;
  const pasos = [
    { ok: Boolean(ajustes), texto: "Revisá el ciclo lectivo, el trimestre, la nota de aprobación y el horario escolar", href: "/configuracion", boton: "Configuración" },
    { ok: cs.length > 0, texto: "Creá los cursos (podés crear todos los de un nivel de una vez)", href: "/cursos", boton: "Cursos" },
    { ok: profes.length > 0 && us.some((x) => x.rol === "preceptor"), texto: "Cargá a docentes y preceptores (uno por uno o pegando una planilla)", href: "/usuarios?tab=importar", boton: "Equipo" },
    { ok: cs.length > 0 && sinPrec === 0, texto: sinPrec ? `Asigná preceptor a ${sinPrec} curso${sinPrec > 1 ? "s" : ""}` : "Asigná un preceptor a cada curso", href: "/cursos", boton: "Cursos" },
    { ok: mats.length > 0 && sinDocente === 0, texto: mats.length ? `Asigná docente a ${sinDocente} materia${sinDocente > 1 ? "s" : ""}` : "Creá las materias de cada curso y asigná quién las dicta", href: "/materias", boton: "Materias" },
    { ok: als.length > 0, texto: "Cargá a los alumnos y sus familias", href: "/usuarios?tab=importar", boton: "Alumnos" },
    { ok: als.length > 0 && sinFamilia === 0, texto: sinFamilia ? `Vinculá una familia a ${sinFamilia} alumno${sinFamilia > 1 ? "s" : ""}` : "Vinculá a cada alumno con su familia", href: "/usuarios?tab=alumnos", boton: "Alumnos" },
    { ok: hs.length > 0, texto: "Generá los horarios de todos los cursos", href: "/horarios", boton: "Horarios" },
  ];
  const hechos = pasos.filter((p) => p.ok).length;
  if (hechos === pasos.length) return null;
  return (
    <Seccion titulo="Primeros pasos para poner en marcha el colegio" acciones={<Chip tono="marca">{hechos} de {pasos.length}</Chip>} className="mb-4">
      <ol className="grid gap-2">
        {pasos.map((p, i) => (
          <li key={i} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${p.ok ? "bg-ok-soft text-ok" : "border border-line"}`}>
            <span className="flex items-center gap-3">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${p.ok ? "bg-ok text-white" : "border border-line text-muted"}`}>{p.ok ? "✓" : i + 1}</span>
              <span className={p.ok ? "" : "text-ink"}>{p.texto}</span>
            </span>
            {!p.ok && <Link href={p.href} className="btn-sec btn-chico">{p.boton}</Link>}
          </li>
        ))}
      </ol>
    </Seccion>
  );
}
