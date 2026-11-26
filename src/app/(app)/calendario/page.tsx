import Link from "next/link";
import { requerir } from "@/lib/auth";
import { cursosDe, materiasDe } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { eventosEntre } from "@/lib/consultas";
import { diaSemana, fLarga, hoy, mesNombre, sumarDias } from "@/lib/fechas";
import { Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { ChipEvento, TIPO_EVENTO } from "@/components/eventos";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { borrarEvento, crearEvento } from "./acciones";

export const metadata = { title: "Calendario" };

export default async function Calendario({ searchParams }: PageProps<"/calendario">) {
  const u = await requerir();
  const sp = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(String(sp.mes)) ? String(sp.mes) : hoy().slice(0, 7);
  const cursos = await cursosDe(u);
  const cursoSel = cursos.find((c) => c.id === Number(sp.curso));
  const primero = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const inicioGrilla = sumarDias(primero, 1 - diaSemana(primero));
  const finGrilla = sumarDias(ultimo, 7 - diaSemana(ultimo));
  const evs = await eventosEntre(cursoSel ? [cursoSel.id] : u.rol === "directivo" ? "todos" : cursos.map((c) => c.id), inicioGrilla, finGrilla);
  const mesAnt = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const mesSig = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const q = (x: string) => `/calendario?mes=${x}${cursoSel ? `&curso=${cursoSel.id}` : ""}`;
  const dias: string[] = [];
  for (let d = inicioGrilla; d <= finGrilla; d = sumarDias(d, 1)) dias.push(d);
  const puedeCrear = u.rol !== "padre";
  const mats = puedeCrear ? await materiasDe(u) : [];
  const delMes = evs.filter((e) => e.fecha.startsWith(mes));

  return (
    <>
      <Encabezado
        titulo="Calendario"
        bajada={`Evaluaciones, actos, salidas y días sin clases. Máximo ${REGLAS.maxEvaluacionesPorDia} evaluaciones por día y por curso.`}
      />
      <Pestanas activo={cursoSel?.id ?? 0} items={[{ clave: 0, texto: u.rol === "directivo" ? "Todo el colegio" : "Todos mis cursos", href: `/calendario?mes=${mes}` }, ...cursos.map((c) => ({ clave: c.id, texto: c.nombre, href: `/calendario?mes=${mes}&curso=${c.id}` }))]} />
      <div className={`grid gap-4 ${puedeCrear ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0">
          <Seccion
            titulo={mesNombre(mes)}
            acciones={
              <div className="flex gap-1">
                <Link href={q(mesAnt)} className="btn-sec btn-chico" aria-label="Mes anterior">←</Link>
                <Link href={q(hoy().slice(0, 7))} className="btn-sec btn-chico">Hoy</Link>
                <Link href={q(mesSig)} className="btn-sec btn-chico" aria-label="Mes siguiente">→</Link>
              </div>
            }
          >
            <div className="hidden grid-cols-7 gap-1 sm:grid">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <p key={d} className="eyebrow px-1 pb-1">{d}</p>)}
              {dias.map((d) => {
                const es = evs.filter((e) => e.fecha === d);
                const nEval = cursoSel ? es.filter((e) => e.tipo === "evaluacion").length : 0;
                const fuera = !d.startsWith(mes);
                const sinClases = es.some((e) => e.tipo === "feriado") || diaSemana(d) > 5;
                return (
                  <div key={d} className={`min-h-24 rounded-xl border p-1.5 ${d === hoy() ? "border-brand ring-1 ring-brand" : "border-line"} ${fuera ? "opacity-40" : ""} ${sinClases ? "bg-surface-2" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`tabular text-xs font-bold ${d === hoy() ? "text-brand" : "text-muted"}`}>{Number(d.slice(8))}</span>
                      {nEval >= REGLAS.maxEvaluacionesPorDia && <span className="rounded bg-bad-soft px-1 text-[10px] font-bold text-bad" title="Cupo de evaluaciones completo">{nEval}/{REGLAS.maxEvaluacionesPorDia}</span>}
                    </div>
                    <ul className="mt-1 grid gap-0.5">
                      {es.slice(0, 4).map((e) => (
                        <li key={e.id} className="flex items-center gap-1 text-[11px] leading-tight" title={`${e.titulo}${e.curso ? ` · ${e.curso}` : ""}`}>
                          <span className={`size-1.5 shrink-0 rounded-full ${TIPO_EVENTO[e.tipo]?.color}`} aria-hidden />
                          <span className="truncate">{!cursoSel && e.curso ? `${e.curso} ` : ""}{e.titulo.replace(/^Evaluación de /, "Ev. ").replace(/^Salida: /, "")}</span>
                        </li>
                      ))}
                      {es.length > 4 && <li className="text-[11px] text-muted">+{es.length - 4} más</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="sm:mt-5">
              <p className="eyebrow mb-2 hidden sm:block">Detalle del mes</p>
              {delMes.length === 0 ? <Vacio titulo="No hay eventos este mes" /> : (
                <ul className="divide-y divide-line">
                  {delMes.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-start gap-3 py-2.5">
                      <span className="tabular w-28 shrink-0 text-sm font-semibold">{fLarga(e.fecha).split(",")[0]} {Number(e.fecha.slice(8))}{e.hora ? ` · ${e.hora}` : ""}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{e.titulo}</span>
                        <span className="block text-xs text-muted">{e.curso ?? "Todo el colegio"}{e.descripcion ? ` · ${e.descripcion}` : ""}</span>
                      </span>
                      <ChipEvento tipo={e.tipo} />
                      {puedeCrear && e.tipo !== "salida" && (e.autorId === u.id || u.rol === "directivo") && (
                        <form action={borrarEvento.bind(null, e.id)}><Confirmar mensaje="¿Borrar?">Borrar</Confirmar></form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Seccion>
        </div>
        {puedeCrear && (
          <Seccion titulo="Agregar fecha" className="self-start">
            <FormAccion accion={crearEvento} className="grid gap-3">
              <label className="campo"><span>Título</span><input id="ev-titulo" name="titulo" className="input" required placeholder="Ej. Evaluación de Matemática" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Tipo</span>
                  <select id="ev-tipo" name="tipo" className="input" defaultValue={u.rol === "profesor" ? "evaluacion" : "acto"}>
                    <option value="evaluacion">Evaluación</option>
                    <option value="acto">Acto</option>
                    <option value="reunion">Reunión</option>
                    {u.rol === "directivo" && <option value="feriado">Sin clases</option>}
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <label className="campo"><span>Hora</span><input id="ev-hora" name="hora" type="time" className="input" /></label>
              </div>
              <label className="campo"><span>Fecha</span><input id="ev-fecha" name="fecha" type="date" defaultValue={sumarDias(hoy(), 1)} className="input" required /></label>
              <label className="campo"><span>Curso</span>
                <select id="ev-curso" name="curso" className="input" defaultValue={cursoSel?.id ?? ""}>
                  {u.rol === "directivo" && <option value="">Todo el colegio</option>}
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              {mats.length > 0 && u.rol !== "preceptor" && (
                <label className="campo"><span>Materia (evaluaciones)</span>
                  <select id="ev-materia" name="materia" className="input"><option value="">—</option>{mats.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.curso}</option>)}</select>
                </label>
              )}
              <label className="campo"><span>Detalle (opcional)</span><input id="ev-desc" name="descripcion" className="input" /></label>
              <label className="flex items-center gap-2 text-sm"><input id="ev-avisar" type="checkbox" name="avisar" defaultChecked className="size-4 accent-[var(--brand)]" /> Avisar a las familias</label>
              <Enviar>Agregar</Enviar>
            </FormAccion>
          </Seccion>
        )}
      </div>
    </>
  );
}
