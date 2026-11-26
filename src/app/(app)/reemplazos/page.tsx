import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todosLosUsuarios } from "@/lib/alcance";
import { MODULOS } from "@/lib/config";
import { esHabil, fLarga, hoy, sumarDias } from "@/lib/fechas";
import { modulosAfectados, sugerirReemplazos } from "@/lib/reemplazos";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { asignar, borrarAusencia, quitarCobertura, registrarAusencia } from "./acciones";

export const metadata = { title: "Reemplazos" };

export default async function Reemplazos({ searchParams }: PageProps<"/reemplazos">) {
  await requerir("preceptor", "directivo");
  const sp = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.fecha)) ? String(sp.fecha) : hoy();
  const [mods, aus, us, cobs] = await Promise.all([modulosAfectados(fecha), db.ausenciasDocentes.todos((a) => a.fecha === fecha), todosLosUsuarios(), db.coberturas.todos()]);
  const sugerencias = await Promise.all(mods.map((m) => (m.reemplazanteId ? Promise.resolve([]) : sugerirReemplazos(fecha, m))));
  const profes = us.filter((x) => x.rol === "profesor" && x.activo);
  const proximas = await db.ausenciasDocentes.todos((a) => a.fecha > fecha && a.fecha <= sumarDias(fecha, 14));

  return (
    <>
      <Encabezado titulo="Reemplazos" bajada="Registrá la ausencia de un docente y el sistema sugiere quién puede cubrir cada módulo según sus horas libres." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link className="btn-sec btn-chico" href={`/reemplazos?fecha=${sumarDias(fecha, -1)}`} aria-label="Día anterior">←</Link>
        <Link className="btn-sec btn-chico" href="/reemplazos">Hoy</Link>
        <Link className="btn-sec btn-chico" href={`/reemplazos?fecha=${sumarDias(fecha, 1)}`} aria-label="Día siguiente">→</Link>
        <span className="font-semibold">{fLarga(fecha)}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-4">
          {!esHabil(fecha) ? <Vacio titulo="No es día hábil" /> : aus.length === 0 ? <Vacio titulo="No hay docentes ausentes este día" /> : (
            aus.map((a) => {
              const suyos = mods.filter((m) => m.ausenciaId === a.id);
              const p = us.find((x) => x.id === a.profesorId);
              return (
                <Seccion
                  key={a.id}
                  titulo={<span>{nombreCompleto(p)} <span className="block text-sm font-normal text-muted">{a.motivo} · {suyos.filter((m) => m.reemplazanteId).length}/{suyos.length} módulos cubiertos</span></span>}
                  acciones={<form action={borrarAusencia.bind(null, a.id)}><Confirmar mensaje="¿Borrar ausencia?">Borrar</Confirmar></form>}
                >
                  {suyos.length === 0 ? <p className="text-sm text-muted">No tiene clases este día.</p> : (
                    <ul className="grid gap-3">
                      {suyos.map((m) => {
                        const sug = sugerencias[mods.indexOf(m)];
                        const cob = cobs.find((c) => c.ausenciaId === a.id && c.horarioId === m.horarioId);
                        return (
                          <li key={m.horarioId} className={`rounded-xl border p-3 ${m.reemplazanteId ? "border-ok/40 bg-ok-soft" : "border-warn/40 bg-warn-soft/50"}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold"><span className="tabular">{m.modulo}° · {MODULOS[m.modulo - 1].desde}</span> · {m.curso} · {m.materia}</p>
                              {m.reemplazanteId ? (
                                <span className="flex items-center gap-2"><Chip tono="ok">Cubre {m.reemplazante}</Chip>{cob && <form action={quitarCobertura.bind(null, cob.id)}><button className="btn-sec btn-chico">Cambiar</button></form>}</span>
                              ) : <Chip tono="aviso">Sin cubrir</Chip>}
                            </div>
                            {!m.reemplazanteId && (
                              sug.length === 0 ? <p className="mt-2 text-sm text-muted">No hay nadie libre en ese módulo. Considerá adelantar o reubicar al curso.</p> : (
                                <ul className="mt-3 grid gap-2">
                                  {sug.map((s, i) => (
                                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-2.5 text-sm">
                                      <span className="min-w-0">
                                        <strong>{s.nombre}</strong>{i === 0 && <Chip tono="marca">Recomendado</Chip>}
                                        <span className="block text-xs text-muted">{s.motivos.join(" · ") || "Libre en ese módulo"}</span>
                                      </span>
                                      <form action={asignar.bind(null, a.id, m.horarioId, s.id)}><Enviar className="btn-prim btn-chico" pendiente="…">Asignar</Enviar></form>
                                    </li>
                                  ))}
                                </ul>
                              )
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Seccion>
              );
            })
          )}
        </div>
        <div className="grid content-start gap-4">
          <Seccion titulo="Registrar ausencia">
            <FormAccion accion={registrarAusencia} className="grid gap-3">
              <label className="campo"><span>Docente</span><select id="au-prof" name="profesor" className="input">{profes.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)} · {p.cargo?.replace("Docente de ", "")}</option>)}</select></label>
              <label className="campo"><span>Día</span><input id="au-fecha" name="fecha" type="date" min={hoy()} defaultValue={fecha >= hoy() ? fecha : hoy()} className="input" /></label>
              <label className="campo"><span>Motivo</span><input id="au-motivo" name="motivo" className="input" placeholder="Licencia, capacitación, trámite…" /></label>
              <Enviar>Registrar</Enviar>
            </FormAccion>
          </Seccion>
          {proximas.length > 0 && (
            <Seccion titulo="Próximas ausencias">
              <ul className="grid gap-1.5 text-sm">
                {proximas.sort((a, b) => a.fecha.localeCompare(b.fecha)).map((a) => (
                  <li key={a.id}><Link className="hover:underline" href={`/reemplazos?fecha=${a.fecha}`}><span>{fLarga(a.fecha)}</span>: {nombreCompleto(us.find((x) => x.id === a.profesorId))}</Link></li>
                ))}
              </ul>
            </Seccion>
          )}
        </div>
      </div>
    </>
  );
}
