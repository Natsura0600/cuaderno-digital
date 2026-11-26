import Link from "next/link";
import { db, type Horario } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe, hijosDe, nombreCompleto, todasLasMaterias, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { DIAS, MODULOS, REGLAS } from "@/lib/config";
import { diaSemana, hoy } from "@/lib/fechas";
import { detectarConflictos } from "@/lib/horarios";
import { Aviso, Chip, Encabezado, Pestanas, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { generarTodo, guardarDisponibilidad, guardarGrilla } from "./acciones";

export const metadata = { title: "Horarios" };

const PALETA = ["bg-brand-soft", "bg-gold-soft", "bg-info-soft", "bg-ok-soft", "bg-warn-soft", "bg-bad-soft", "bg-surface-2"];

type Celda = { titulo: string; sub: string; color: string; alerta?: boolean };

function Grilla({ celdas }: { celdas: (dia: number, modulo: number) => Celda[] }) {
  const d = diaSemana(hoy());
  return (
    <TablaScroll>
      <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-24 text-left text-xs font-semibold text-muted">Módulo</th>
            {[1, 2, 3, 4, 5].map((dia) => (
              <th key={dia} className={`rounded-lg py-1.5 text-xs font-semibold uppercase tracking-wide ${dia === d ? "bg-brand text-brand-ink" : "text-muted"}`}>{DIAS[dia]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => (
            <tr key={m.n}>
              <td className="tabular pr-2 align-top text-xs text-muted"><strong className="block text-ink">{m.n}°</strong>{m.desde}–{m.hasta}</td>
              {[1, 2, 3, 4, 5].map((dia) => {
                const cs = celdas(dia, m.n);
                return (
                  <td key={dia} className="h-14 align-top">
                    {cs.length === 0 ? (
                      <div className="h-full min-h-12 rounded-lg border border-dashed border-line" />
                    ) : (
                      cs.map((c, i) => (
                        <div key={i} className={`mb-0.5 min-h-12 rounded-lg px-2 py-1.5 ${c.alerta ? "bg-bad-soft text-bad ring-2 ring-bad" : c.color}`}>
                          <p className="truncate text-[13px] font-semibold leading-tight">{c.titulo}</p>
                          <p className="truncate text-xs text-muted">{c.sub}</p>
                        </div>
                      ))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TablaScroll>
  );
}

export default async function Horarios({ searchParams }: PageProps<"/horarios">) {
  const u = await requerir();
  const sp = await searchParams;
  const [hs, mats, cursos, aulas, us, nd] = await Promise.all([db.horarios.todos(), todasLasMaterias(), todosLosCursos(), db.aulas.todos(), todosLosUsuarios(), db.noDisponible.todos()]);
  const mat = (id: number) => mats.find((m) => m.id === id)!;
  const colorMateria = (id: number) => PALETA[[...new Set(mats.map((m) => m.nombre))].indexOf(mat(id).nombre) % PALETA.length];
  const filas = hs.map((h) => {
    const m = mat(h.materiaId);
    const p = us.find((x) => x.id === m.profesorId);
    return { id: h.id, cursoId: h.cursoId, curso: cursos.find((c) => c.id === h.cursoId)!.nombre, materia: m.nombre, profesorId: m.profesorId, profesor: p ? nombreCompleto(p) : null, aulaId: h.aulaId, aula: aulas.find((a) => a.id === h.aulaId)?.nombre ?? null, dia: h.dia, modulo: h.modulo };
  });
  const conflictos = detectarConflictos(filas, nd);
  const enConflicto = new Set(conflictos.flatMap((c) => c.ids));

  const grillaCurso = (cursoId: number) => (dia: number, modulo: number) =>
    hs.filter((h) => h.cursoId === cursoId && h.dia === dia && h.modulo === modulo).map((h: Horario) => ({
      titulo: mat(h.materiaId).nombre,
      sub: `${filas.find((f) => f.id === h.id)?.profesor ?? "Sin docente"} · ${aulas.find((a) => a.id === h.aulaId)?.nombre ?? ""}`,
      color: colorMateria(h.materiaId),
      alerta: enConflicto.has(h.id),
    }));
  const grillaDocente = (profId: number) => (dia: number, modulo: number) =>
    hs.filter((h) => mat(h.materiaId).profesorId === profId && h.dia === dia && h.modulo === modulo).map((h) => ({
      titulo: `${cursos.find((c) => c.id === h.cursoId)?.nombre} · ${mat(h.materiaId).nombre}`,
      sub: aulas.find((a) => a.id === h.aulaId)?.nombre ?? "",
      color: colorMateria(h.materiaId),
      alerta: enConflicto.has(h.id),
    }));

  if (u.rol === "profesor") {
    const mios = nd.filter((n) => n.profesorId === u.id);
    return (
      <>
        <Encabezado titulo="Mi horario" bajada={`${hs.filter((h) => mat(h.materiaId).profesorId === u.id).length} módulos semanales`} />
        <Seccion><Grilla celdas={grillaDocente(u.id)} /></Seccion>
        <Seccion titulo="Mi disponibilidad" className="mt-4">
          <p className="mb-3 text-sm text-muted">Marcá los módulos en los que <strong>no</strong> podés dar clase (por ejemplo, porque trabajás en otra escuela). Dirección los usa para generar el horario.</p>
          <FormAccion accion={guardarDisponibilidad} reiniciar={false}>
            <TablaScroll>
              <table className="tabla tabular min-w-[560px]">
                <thead><tr><th>Módulo</th>{[1, 2, 3, 4, 5].map((d) => <th key={d} className="!text-center">{DIAS[d]}</th>)}</tr></thead>
                <tbody>
                  {MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => (
                    <tr key={m.n}>
                      <td>{m.n}° <span className="text-muted">{m.desde}</span></td>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <td key={d} className="!text-center">
                          <input type="checkbox" id={`nd-${d}-${m.n}`} name={`nd-${d}-${m.n}`} defaultChecked={mios.some((n) => n.dia === d && n.modulo === m.n)} className="size-5 accent-[var(--bad)]" aria-label={`${DIAS[d]} módulo ${m.n} no disponible`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
            <div className="mt-3"><Enviar className="btn-sec">Guardar disponibilidad</Enviar></div>
          </FormAccion>
        </Seccion>
      </>
    );
  }

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    if (!hijos.length) return <Vacio titulo="No hay alumnos vinculados" />;
    const h = hijos.find((x) => x.id === Number(sp.hijo)) ?? hijos[0];
    return (
      <>
        <Encabezado titulo="Horario" bajada={`${h.nombre} · ${h.curso}`} />
        {hijos.length > 1 && <Pestanas activo={h.id} items={hijos.map((x) => ({ href: `/horarios?hijo=${x.id}`, texto: x.nombre, clave: x.id }))} />}
        <Seccion><Grilla celdas={grillaCurso(h.cursoId)} /></Seccion>
      </>
    );
  }

  const mis = await cursosDe(u);
  const profes = us.filter((x) => x.rol === "profesor");
  const porDocente = u.rol === "directivo" && sp.docente ? profes.find((p) => p.id === Number(sp.docente)) : null;
  const c = mis.find((x) => x.id === Number(sp.curso)) ?? mis[0];
  if (!c) return <Vacio titulo="No tenés cursos a cargo" />;
  const editar = u.rol === "directivo" && sp.editar === "1";
  const matsCurso = mats.filter((m) => m.cursoId === c.id);

  return (
    <>
      <Encabezado
        titulo="Horarios"
        bajada={porDocente ? `Vista por docente: ${nombreCompleto(porDocente)}` : `${c.nombre} · ${matsCurso.reduce((s, m) => s + m.horasSemanales, 0)} módulos semanales`}
        acciones={
          u.rol === "directivo" && !porDocente ? (
            <Link href={editar ? `/horarios?curso=${c.id}` : `/horarios?curso=${c.id}&editar=1`} className="btn-sec">{editar ? "Cancelar edición" : "Editar a mano"}</Link>
          ) : undefined
        }
      />
      <Pestanas activo={porDocente ? "" : c.id} items={mis.map((x) => ({ href: `/horarios?curso=${x.id}`, texto: x.nombre, clave: x.id }))} />
      {u.rol === "directivo" && (
        <form action="/horarios" className="mb-4 flex flex-wrap items-end gap-2">
          <label className="campo">
            <span>Ver por docente</span>
            <select id="docente" name="docente" className="input" defaultValue={porDocente?.id ?? ""}>
              <option value="">Elegí un docente…</option>
              {profes.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}
            </select>
          </label>
          <button className="btn-sec">Ver</button>
        </form>
      )}

      {u.rol === "directivo" && (
        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          {conflictos.length ? (
            <Aviso tono="peligro">
              <p className="font-semibold">Hay {conflictos.length} superposicion{conflictos.length > 1 ? "es" : ""}:</p>
              <ul className="mt-1 list-disc pl-5">{conflictos.slice(0, 6).map((x, i) => <li key={i}>{DIAS[x.dia]} {x.modulo}° módulo: {x.detalle}</li>)}</ul>
            </Aviso>
          ) : (
            <Aviso tono="ok">Sin superposiciones de docentes, aulas ni cursos, y respetando la disponibilidad cargada.</Aviso>
          )}
          <FormAccion accion={generarTodo} reiniciar={false} className="card flex flex-col justify-center gap-2 p-4">
            <p className="text-sm text-muted">Arma de nuevo la grilla de todos los cursos.</p>
            <Enviar pendiente="Generando…">Generar horarios automáticamente</Enviar>
          </FormAccion>
        </div>
      )}

      {porDocente ? (
        <Seccion><Grilla celdas={grillaDocente(porDocente.id)} /></Seccion>
      ) : editar ? (
        <Seccion titulo="Edición manual">
          <FormAccion accion={guardarGrilla.bind(null, c.id)} reiniciar={false}>
            <TablaScroll>
              <table className="tabla min-w-[760px]">
                <thead><tr><th>Módulo</th>{[1, 2, 3, 4, 5].map((d) => <th key={d}>{DIAS[d]}</th>)}</tr></thead>
                <tbody>
                  {MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => (
                    <tr key={m.n}>
                      <td className="tabular">{m.n}°</td>
                      {[1, 2, 3, 4, 5].map((d) => {
                        const h = hs.find((x) => x.cursoId === c.id && x.dia === d && x.modulo === m.n);
                        return (
                          <td key={d}>
                            <select id={`c-${d}-${m.n}`} name={`c-${d}-${m.n}`} defaultValue={h?.materiaId ?? ""} className="input !py-1.5 text-xs" aria-label={`${DIAS[d]} módulo ${m.n}`}>
                              <option value="">Libre</option>
                              {matsCurso.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
            <div className="mt-3 flex justify-end"><Enviar>Guardar grilla de {c.nombre}</Enviar></div>
          </FormAccion>
        </Seccion>
      ) : (
        <Seccion><Grilla celdas={grillaCurso(c.id)} /></Seccion>
      )}

      {!porDocente && (
        <Seccion titulo="Carga horaria" className="mt-4">
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {matsCurso.map((m) => {
              const n = hs.filter((h) => h.materiaId === m.id).length;
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                  <span className="min-w-0 truncate">{m.nombre}<span className="block text-xs text-muted">{nombreCompleto(us.find((x) => x.id === m.profesorId))}</span></span>
                  <Chip tono={n === m.horasSemanales ? "ok" : "aviso"}>{n}/{m.horasSemanales} h</Chip>
                </li>
              );
            })}
          </ul>
        </Seccion>
      )}
    </>
  );
}
