import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todosLosUsuarios } from "@/lib/alcance";
import { MODULOS, REGLAS } from "@/lib/config";
import { diaSemana, esHabil, fLarga, hoy, sumarDias } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, TablaScroll } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { agregarItem, cambiarEstadoItem, cancelarReserva, reservar } from "./acciones";

export const metadata = { title: "Espacios y equipos" };

const ESTADO = { disponible: { t: "Disponible", tono: "ok" as const }, en_reparacion: { t: "En reparación", tono: "aviso" as const }, baja: { t: "De baja", tono: "neutro" as const } };

export default async function Espacios({ searchParams }: PageProps<"/espacios">) {
  const u = await requerir("profesor", "preceptor", "directivo");
  const sp = await searchParams;
  let fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.fecha)) ? String(sp.fecha) : hoy();
  if (!esHabil(fecha)) fecha = sumarDias(fecha, 8 - diaSemana(fecha));
  const [items, reservas, us] = await Promise.all([db.espacios.todos(), db.reservas.todos((r) => r.fecha >= hoy()), todosLosUsuarios()]);
  const delDia = reservas.filter((r) => r.fecha === fecha);
  const mias = reservas.filter((r) => r.usuarioId === u.id).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.moduloDesde - b.moduloDesde);
  const activos = items.filter((i) => i.estado !== "baja");

  return (
    <>
      <Encabezado titulo="Espacios y equipos" bajada="Reservá laboratorio, gimnasio, SUM, biblioteca, proyectores y notebooks por módulo." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-4">
          <Seccion
            titulo={<span>Ocupación · {fLarga(fecha)}</span>}
            acciones={
              <div className="flex gap-1">
                <Link className="btn-sec btn-chico" href={`/espacios?fecha=${sumarDias(fecha, -1)}`} aria-label="Día anterior">←</Link>
                <Link className="btn-sec btn-chico" href="/espacios">Hoy</Link>
                <Link className="btn-sec btn-chico" href={`/espacios?fecha=${sumarDias(fecha, 1)}`} aria-label="Día siguiente">→</Link>
              </div>
            }
          >
            <TablaScroll>
              <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr><th className="text-left text-xs font-semibold text-muted">Espacio / equipo</th>{MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => <th key={m.n} className="tabular text-xs font-semibold text-muted">{m.n}°<span className="block font-normal">{m.desde}</span></th>)}</tr>
                </thead>
                <tbody>
                  {activos.map((i) => (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap pr-2 font-medium">{i.nombre}{i.cantidad > 1 && <span className="text-muted"> ×{i.cantidad}</span>}</td>
                      {MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => {
                        const rs = delDia.filter((r) => r.espacioId === i.id && r.moduloDesde <= m.n && r.moduloHasta >= m.n);
                        const lleno = rs.length >= i.cantidad;
                        return (
                          <td key={m.n} title={rs.map((r) => `${nombreCompleto(us.find((x) => x.id === r.usuarioId))}: ${r.motivo ?? ""}`).join("\n")}
                            className={`h-9 rounded-md text-center text-[11px] font-semibold ${i.estado !== "disponible" ? "bg-surface-2 text-muted" : lleno ? "bg-bad-soft text-bad" : rs.length ? "bg-warn-soft text-warn" : "bg-ok-soft/60"}`}>
                            {i.estado !== "disponible" ? "—" : rs.length ? (i.cantidad > 1 ? `${rs.length}/${i.cantidad}` : us.find((x) => x.id === rs[0].usuarioId)?.apellido) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </Seccion>
          {mias.length > 0 && (
            <Seccion titulo="Mis reservas">
              <ul className="grid gap-2 text-sm">
                {mias.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                    <span><strong>{items.find((i) => i.id === r.espacioId)?.nombre}</strong> · <span>{fLarga(r.fecha)}</span> · módulos {r.moduloDesde}° a {r.moduloHasta}°{r.motivo ? ` · ${r.motivo}` : ""}</span>
                    <form action={cancelarReserva.bind(null, r.id)}><Confirmar mensaje="¿Cancelar?">Cancelar</Confirmar></form>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
          <Seccion titulo="Inventario">
            <TablaScroll>
              <table className="tabla">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Cant.</th><th>Ubicación</th><th>Estado</th>{u.rol === "directivo" && <th></th>}</tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="font-medium">{i.nombre}</td>
                      <td className="text-muted">{i.tipo === "espacio" ? "Espacio" : i.categoria}</td>
                      <td className="tabular">{i.cantidad}</td>
                      <td className="text-muted">{i.ubicacion ?? "—"}</td>
                      <td><Chip tono={ESTADO[i.estado].tono}>{ESTADO[i.estado].t}</Chip></td>
                      {u.rol === "directivo" && (
                        <td className="whitespace-nowrap">
                          <div className="flex gap-1">
                            {(["disponible", "en_reparacion", "baja"] as const).filter((e) => e !== i.estado).map((e) => (
                              <form key={e} action={cambiarEstadoItem.bind(null, i.id, e)}><button className="btn-sec btn-chico">{ESTADO[e].t}</button></form>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </Seccion>
        </div>
        <div className="grid content-start gap-4">
          <Seccion titulo="Nueva reserva">
            <FormAccion accion={reservar} className="grid gap-3">
              <label className="campo"><span>Qué</span><select id="re-esp" name="espacio" className="input">{activos.filter((i) => i.estado === "disponible").map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>
              <label className="campo"><span>Día</span><input id="re-fecha" name="fecha" type="date" min={hoy()} defaultValue={fecha} className="input" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Desde módulo</span><select id="re-desde" name="desde" className="input">{MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => <option key={m.n} value={m.n}>{m.n}° ({m.desde})</option>)}</select></label>
                <label className="campo"><span>Hasta módulo</span><select id="re-hasta" name="hasta" className="input" defaultValue={2}>{MODULOS.slice(0, REGLAS.modulosPorDia).map((m) => <option key={m.n} value={m.n}>{m.n}° ({m.hasta})</option>)}</select></label>
              </div>
              <label className="campo"><span>Para qué (opcional)</span><input id="re-motivo" name="motivo" className="input" /></label>
              <Enviar>Reservar</Enviar>
            </FormAccion>
          </Seccion>
          {u.rol === "directivo" && (
            <Seccion titulo="Agregar al inventario">
              <FormAccion accion={agregarItem} className="grid gap-3">
                <label className="campo"><span>Nombre</span><input id="in-nombre" name="nombre" className="input" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="campo"><span>Tipo</span><select id="in-tipo" name="tipo" className="input"><option value="equipo">Equipo</option><option value="espacio">Espacio</option></select></label>
                  <label className="campo"><span>Cantidad</span><input id="in-cant" name="cantidad" type="number" min={1} defaultValue={1} className="input" /></label>
                </div>
                <label className="campo"><span>Categoría</span><input id="in-cat" name="categoria" className="input" placeholder="Proyector, Audio, Laboratorio…" /></label>
                <label className="campo"><span>Ubicación</span><input id="in-ubic" name="ubicacion" className="input" /></label>
                <Enviar className="btn-sec">Agregar</Enviar>
              </FormAccion>
            </Seccion>
          )}
        </div>
      </div>
    </>
  );
}
