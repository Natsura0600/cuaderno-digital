import Link from "next/link";
import { db, type Planificacion, type Tema } from "@/db";
import { requerir } from "@/lib/auth";
import { materiasDe, nombreCompleto, puedeEditarMateria, todosLosUsuarios } from "@/lib/alcance";
import { fCorta, hoy, lunesDe, sumarDias } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { agregarTema, borrarPlan, guardarPlan, marcarDictada } from "./acciones";

export const metadata = { title: "Planificación" };

function cobertura(temas: Tema[], planes: Planificacion[]) {
  const dados = new Set(planes.filter((p) => p.dictada).flatMap((p) => p.temaIds));
  return { dados, pct: temas.length ? Math.round((temas.filter((t) => dados.has(t.id)).length / temas.length) * 100) : 0 };
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${pct < 60 ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} /></div>
      <span className="tabular text-sm font-semibold">{pct} %</span>
    </div>
  );
}

export default async function PlanificacionPage({ searchParams }: PageProps<"/planificacion">) {
  const u = await requerir("profesor", "directivo");
  const sp = await searchParams;
  const mats = await materiasDe(u);
  const [temas, planes, us] = await Promise.all([db.temas.todos(), db.planificaciones.todos(), todosLosUsuarios()]);
  const semana = lunesDe(hoy());
  const m = mats.find((x) => x.id === Number(sp.materia)) ?? (u.rol === "profesor" ? mats[0] : undefined);

  if (!m) {
    return (
      <>
        <Encabezado titulo="Avance curricular" bajada="Qué porcentaje del programa ya se dictó en cada materia, según las planificaciones semanales." />
        <Seccion>
          <TablaScroll>
            <table className="tabla">
              <thead><tr><th>Curso</th><th>Materia</th><th>Docente</th><th>Programa dictado</th><th>Esta semana</th></tr></thead>
              <tbody>
                {mats.map((x) => {
                  const ts = temas.filter((t) => t.materiaId === x.id);
                  const ps = planes.filter((p) => p.materiaId === x.id);
                  const { pct } = cobertura(ts, ps);
                  return (
                    <tr key={x.id}>
                      <td className="whitespace-nowrap">{x.curso}</td>
                      <td><Link href={`/planificacion?materia=${x.id}`} className="font-medium hover:underline">{x.nombre}</Link></td>
                      <td className="whitespace-nowrap text-muted">{nombreCompleto(us.find((p) => p.id === x.profesorId))}</td>
                      <td><Barra pct={pct} /></td>
                      <td>{ps.some((p) => p.semana === semana) ? <Chip tono="ok">Planificada</Chip> : <Chip tono="aviso">Sin cargar</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TablaScroll>
        </Seccion>
      </>
    );
  }

  const editable = await puedeEditarMateria(u, m.id);
  const ts = temas.filter((t) => t.materiaId === m.id).sort((a, b) => a.orden - b.orden);
  const ps = planes.filter((p) => p.materiaId === m.id).sort((a, b) => b.semana.localeCompare(a.semana));
  const { dados, pct } = cobertura(ts, ps);
  const planSemana = ps.find((p) => p.semana === semana);
  const unidades = [...new Set(ts.map((t) => t.unidad))];

  return (
    <>
      <Encabezado
        titulo={`${m.nombre} · ${m.curso}`}
        bajada={<span className="flex flex-wrap items-center gap-3">Programa dictado <Barra pct={pct} /></span>}
        volver={u.rol === "directivo" ? { href: "/planificacion", texto: "Avance de todas las materias" } : undefined}
      />
      {u.rol === "profesor" && mats.length > 1 && (
        <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {mats.map((x) => (
            <Link key={x.id} href={`/planificacion?materia=${x.id}`} className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${x.id === m.id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface"}`}>
              {x.nombre} {x.curso}
            </Link>
          ))}
        </nav>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {editable && (
            <Seccion titulo={planSemana ? "Editar la planificación de esta semana" : "Planificar una semana"}>
              <FormAccion accion={guardarPlan.bind(null, m.id)} className="grid gap-3" reiniciar={false}>
                <label className="campo">
                  <span>Semana (cualquier día; se guarda desde el lunes)</span>
                  <input id="semana" type="date" name="semana" defaultValue={semana} min={sumarDias(semana, -60)} className="input" />
                </label>
                <label className="campo">
                  <span>Objetivos</span>
                  <textarea id="objetivos" name="objetivos" rows={2} className="input" defaultValue={planSemana?.objetivos} required />
                </label>
                <label className="campo">
                  <span>Actividades</span>
                  <textarea id="actividades" name="actividades" rows={3} className="input" defaultValue={planSemana?.actividades} required />
                </label>
                <fieldset className="campo">
                  <span>Temas del programa que se trabajan</span>
                  <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-3">
                    {ts.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="temas" value={t.id} defaultChecked={planSemana?.temaIds.includes(t.id)} className="size-4 accent-[var(--brand)]" />
                        <span className={dados.has(t.id) ? "text-muted line-through" : ""}>U{t.unidad} · {t.titulo}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div><Enviar>Guardar planificación</Enviar></div>
              </FormAccion>
            </Seccion>
          )}
          <Seccion titulo="Planificaciones">
            {ps.length === 0 ? <Vacio titulo="Todavía no hay planificaciones" /> : (
              <ol className="grid gap-3">
                {ps.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Semana del {fCorta(p.semana)}</p>
                      <div className="flex items-center gap-2">
                        {p.dictada ? <Chip tono="ok">Dictada</Chip> : <Chip tono="aviso">Pendiente</Chip>}
                        {editable && (
                          <>
                            <form action={marcarDictada.bind(null, p.id, !p.dictada)}><button className="btn-sec btn-chico">{p.dictada ? "Marcar pendiente" : "Marcar dictada"}</button></form>
                            <form action={borrarPlan.bind(null, p.id)}><Confirmar mensaje="¿Borrar?">Borrar</Confirmar></form>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm"><strong>Objetivos:</strong> {p.objetivos}</p>
                    <p className="mt-1 text-sm text-muted">{p.actividades}</p>
                    {p.temaIds.length > 0 && <p className="mt-2 flex flex-wrap gap-1">{p.temaIds.map((id) => <Chip key={id} tono="marca">{ts.find((t) => t.id === id)?.titulo ?? "Tema"}</Chip>)}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Seccion>
        </div>
        <Seccion titulo="Programa de la materia">
          {unidades.map((un) => (
            <div key={un} className="mb-4">
              <p className="eyebrow mb-1.5">Unidad {un}</p>
              <ul className="grid gap-1 text-sm">
                {ts.filter((t) => t.unidad === un).map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dados.has(t.id) ? "bg-ok" : "border border-line"}`} />
                    <span className={dados.has(t.id) ? "" : "text-muted"}>{t.titulo}</span>
                    <span className="sr-only">{dados.has(t.id) ? "(dictado)" : "(pendiente)"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {editable && (
            <FormAccion accion={agregarTema.bind(null, m.id)} className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <label className="campo w-20"><span>Unidad</span><input id="unidad" name="unidad" type="number" min={1} max={12} defaultValue={unidades.at(-1) ?? 1} className="input" /></label>
              <label className="campo flex-1"><span>Nuevo tema</span><input id="titulo-tema" name="titulo" className="input" /></label>
              <Enviar className="btn-sec">Agregar</Enviar>
            </FormAccion>
          )}
        </Seccion>
      </div>
    </>
  );
}
