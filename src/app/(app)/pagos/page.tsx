import { db, claveCuota } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, nombreCompleto, todosLosAlumnos, todosLosCursos } from "@/lib/alcance";
import { fCorta, hoy, mesNombre, pesos, sumarDias } from "@/lib/fechas";
import { Chip, Dato, Encabezado, Pestanas, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { avisarPago, generarCuotas, guardarBeca, quitarBeca, recordarDeuda, registrarPago } from "./acciones";

export const metadata = { title: "Pagos" };

const estadoCuota = (c: { pagada: string | null; vencimiento: string }) =>
  c.pagada ? { t: "Pagada", tono: "ok" as const } : c.vencimiento < hoy() ? { t: "Vencida", tono: "peligro" as const } : c.vencimiento <= sumarDias(hoy(), 7) ? { t: "Vence pronto", tono: "aviso" as const } : { t: "Pendiente", tono: "neutro" as const };

export default async function Pagos({ searchParams }: PageProps<"/pagos">) {
  const u = await requerir("padre", "directivo");
  const sp = await searchParams;

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    if (!hijos.length) return <Vacio titulo="No hay alumnos vinculados" />;
    const h = hijos.find((x) => x.id === Number(sp.hijo)) ?? hijos[0];
    const [cs, becas] = await Promise.all([db.cuotas.lista(h.id), db.becas.todos((b) => b.alumnoId === h.id && b.vigente)]);
    cs.sort((a, b) => b.periodo.localeCompare(a.periodo));
    const deuda = cs.filter((c) => !c.pagada && c.vencimiento < hoy()).reduce((s, c) => s + c.montoBase - c.descuento, 0);
    const prox = cs.filter((c) => !c.pagada && c.vencimiento >= hoy()).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))[0];
    return (
      <>
        <Encabezado titulo="Pagos" bajada={`Estado de cuenta de ${h.nombre} ${h.apellido}`} />
        {hijos.length > 1 && <Pestanas activo={h.id} items={hijos.map((x) => ({ href: `/pagos?hijo=${x.id}`, texto: x.nombre, clave: x.id }))} />}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Dato etiqueta="Saldo vencido" valor={pesos(deuda)} tono={deuda ? "peligro" : "ok"} />
          <Dato etiqueta="Próximo vencimiento" valor={prox ? pesos(prox.montoBase - prox.descuento) : "—"} detalle={prox ? `${prox.concepto} · vence ${fCorta(prox.vencimiento)}` : "Nada pendiente"} />
          {becas.length > 0 && <Dato etiqueta="Beca" valor={`${becas[0].porcentaje} %`} detalle={becas[0].motivo} tono="ok" />}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Seccion titulo="Cuotas">
            <TablaScroll>
              <table className="tabla tabular">
                <thead><tr><th>Mes</th><th>Concepto</th><th className="!text-right">Importe</th><th>Vence</th><th>Estado</th></tr></thead>
                <tbody>
                  {cs.map((c) => {
                    const e = estadoCuota(c);
                    return (
                      <tr key={claveCuota(c.periodo, c.concepto)}>
                        <td className="whitespace-nowrap">{mesNombre(c.periodo)}</td>
                        <td>{c.concepto}</td>
                        <td className="!text-right whitespace-nowrap">{pesos(c.montoBase - c.descuento)}{c.descuento > 0 && <span className="block text-xs text-muted line-through">{pesos(c.montoBase)}</span>}</td>
                        <td className="whitespace-nowrap">{fCorta(c.vencimiento)}</td>
                        <td><Chip tono={e.tono}>{e.t}</Chip>{c.medio && <span className="block text-xs text-muted">{c.medio}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TablaScroll>
          </Seccion>
          <Seccion titulo="¿Ya pagaste?" className="self-start">
            <p className="mb-3 text-sm text-muted">Si pagaste por transferencia o Mercado Pago, avisale a administración para que lo acredite. Los datos para transferir los informa secretaría.</p>
            <FormAccion accion={avisarPago.bind(null, h.id)} className="grid gap-3">
              <label className="campo"><span>Detalle del pago</span><textarea id="p-detalle" name="detalle" rows={3} className="input" placeholder="Ej. Transferencia del 12/11, operación 123456, cuota de noviembre" /></label>
              <Enviar>Avisar a administración</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      </>
    );
  }

  const [als, cursos, becas] = await Promise.all([todosLosAlumnos(), todosLosCursos(), db.becas.todos((b) => b.vigente)]);
  const cuotas = await db.cuotas.deVarios(als.map((a) => a.id));
  const mes = hoy().slice(0, 7);
  const todas = [...cuotas.values()].flat();
  const delMes = todas.filter((c) => c.periodo === mes);
  const cobradoMes = delMes.filter((c) => c.pagada).reduce((s, c) => s + c.montoBase - c.descuento, 0);
  const esperadoMes = delMes.reduce((s, c) => s + c.montoBase - c.descuento, 0);
  const morosos = als
    .map((a) => {
      const v = (cuotas.get(a.id) ?? []).filter((c) => !c.pagada && c.vencimiento < hoy());
      return { a, v, total: v.reduce((s, c) => s + c.montoBase - c.descuento, 0) };
    })
    .filter((x) => x.v.length)
    .sort((x, y) => y.total - x.total);
  const tab = String(sp.tab ?? "morosidad");
  const alSel = als.find((a) => a.id === Number(sp.alumno));
  const ultimo = todas.map((c) => c.periodo).sort().at(-1) ?? mes;
  const [yy, mm] = ultimo.split("-").map(Number);
  const siguiente = new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 7);
  const curso = (id: number) => cursos.find((c) => c.id === id)?.nombre;

  return (
    <>
      <Encabezado titulo="Pagos y becas" bajada="Cuotas, cobranzas, recordatorios y becas." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta={`Cobrado en ${mesNombre(mes).split(" ")[0].toLowerCase()}`} valor={pesos(cobradoMes)} detalle={`de ${pesos(esperadoMes)}`} />
        <Dato etiqueta="Cobranza del mes" valor={esperadoMes ? `${Math.round((cobradoMes / esperadoMes) * 100)} %` : "—"} tono={esperadoMes && cobradoMes / esperadoMes < 0.8 ? "aviso" : "ok"} />
        <Dato etiqueta="Deuda vencida" valor={pesos(morosos.reduce((s, x) => s + x.total, 0))} tono={morosos.length ? "peligro" : "ok"} />
        <Dato etiqueta="Alumnos con deuda" valor={morosos.length} detalle={`${becas.length} con beca`} />
      </div>
      <Pestanas activo={tab} items={[
        { clave: "morosidad", texto: "Morosidad", href: "/pagos?tab=morosidad" },
        { clave: "registrar", texto: "Registrar pago", href: "/pagos?tab=registrar" },
        { clave: "generar", texto: "Generar cuotas", href: "/pagos?tab=generar" },
        { clave: "becas", texto: "Becas", href: "/pagos?tab=becas" },
      ]} />

      {tab === "morosidad" && (
        <Seccion titulo="Reporte de morosidad" acciones={morosos.length ? <form action={recordarDeuda.bind(null, morosos.map((m) => m.a.id))}><Enviar className="btn-sec btn-chico" pendiente="Enviando…">Recordar a todas las familias</Enviar></form> : undefined}>
          {morosos.length === 0 ? <Vacio titulo="No hay cuotas vencidas" /> : (
            <TablaScroll>
              <table className="tabla tabular">
                <thead><tr><th>Alumno</th><th>Curso</th><th>Meses adeudados</th><th className="!text-right">Total</th><th></th></tr></thead>
                <tbody>
                  {morosos.map((m) => (
                    <tr key={m.a.id}>
                      <td className="whitespace-nowrap font-medium">{m.a.apellido}, {m.a.nombre}</td>
                      <td>{curso(m.a.cursoId)}</td>
                      <td>{m.v.map((c) => mesNombre(c.periodo).split(" ")[0]).join(", ")}</td>
                      <td className="!text-right font-semibold text-bad">{pesos(m.total)}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-1">
                          <a href={`/pagos?tab=registrar&alumno=${m.a.id}`} className="btn-sec btn-chico">Registrar pago</a>
                          <form action={recordarDeuda.bind(null, [m.a.id])}><Enviar className="btn-sec btn-chico" pendiente="…">Recordar</Enviar></form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          )}
        </Seccion>
      )}

      {tab === "registrar" && (
        <Seccion titulo="Registrar un pago">
          <form action="/pagos" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value="registrar" />
            <label className="campo min-w-64"><span>Alumno</span>
              <select id="p-alumno" name="alumno" className="input" defaultValue={alSel?.id ?? ""}>
                <option value="">Elegí…</option>
                {als.map((a) => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre} · {curso(a.cursoId)}</option>)}
              </select>
            </label>
            <button className="btn-sec">Ver cuotas</button>
          </form>
          {alSel && (() => {
            const pend = (cuotas.get(alSel.id) ?? []).filter((c) => !c.pagada).sort((a, b) => a.periodo.localeCompare(b.periodo));
            return pend.length === 0 ? <Vacio titulo={`${nombreCompleto(alSel)} no tiene cuotas pendientes`} /> : (
              <FormAccion accion={registrarPago} className="grid gap-3" reiniciar={false}>
                <input type="hidden" name="alumno" value={alSel.id} />
                <ul className="grid gap-1.5">
                  {pend.map((c) => {
                    const e = estadoCuota(c);
                    return (
                      <li key={claveCuota(c.periodo, c.concepto)}>
                        <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
                          <input type="checkbox" name="cuota" value={claveCuota(c.periodo, c.concepto)} defaultChecked={c.vencimiento < hoy()} className="size-4 accent-[var(--brand)]" />
                          <span className="flex-1">{mesNombre(c.periodo)} · {c.concepto}</span>
                          <span className="tabular font-semibold">{pesos(c.montoBase - c.descuento)}</span>
                          <Chip tono={e.tono}>{e.t}</Chip>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <label className="campo max-w-xs"><span>Medio de pago</span><select name="medio" className="input">{["Efectivo en secretaría", "Transferencia", "Mercado Pago", "Débito automático", "Tarjeta"].map((m) => <option key={m}>{m}</option>)}</select></label>
                <div><Enviar>Registrar pago y avisar a la familia</Enviar></div>
              </FormAccion>
            );
          })()}
        </Seccion>
      )}

      {tab === "generar" && (
        <Seccion titulo="Generar cuotas del mes">
          <p className="mb-4 text-sm text-muted">Crea la cuota para todos los alumnos activos y aplica automáticamente las becas vigentes. Si una cuota ya existe, no se duplica.</p>
          <FormAccion accion={generarCuotas} className="grid max-w-xl gap-3 sm:grid-cols-2">
            <label className="campo"><span>Mes</span><input id="g-periodo" name="periodo" type="month" defaultValue={siguiente} className="input" /></label>
            <label className="campo"><span>Vencimiento</span><input id="g-venc" name="vencimiento" type="date" defaultValue={`${siguiente}-10`} className="input" /></label>
            <label className="campo"><span>Concepto</span><input id="g-concepto" name="concepto" defaultValue="Cuota mensual" className="input" /></label>
            <label className="campo"><span>Monto ($)</span><input id="g-monto" name="monto" type="number" min={1} step={100} defaultValue={todas.at(-1)?.montoBase ?? 0} className="input" /></label>
            <div className="sm:col-span-2"><Enviar pendiente="Generando…">Generar cuotas</Enviar></div>
          </FormAccion>
        </Seccion>
      )}

      {tab === "becas" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Seccion titulo="Becas vigentes">
            {becas.length === 0 ? <Vacio titulo="No hay becas" /> : (
              <ul className="grid gap-2">
                {becas.map((b) => {
                  const a = als.find((x) => x.id === b.alumnoId);
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                      <span><strong>{nombreCompleto(a)}</strong> <span className="text-muted">· {a && curso(a.cursoId)} · {b.motivo}</span></span>
                      <span className="flex items-center gap-2"><Chip tono="ok">{b.porcentaje} %</Chip><form action={quitarBeca.bind(null, b.id)}><Confirmar mensaje="¿Dar de baja?">Dar de baja</Confirmar></form></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Seccion>
          <Seccion titulo="Nueva beca" className="self-start">
            <FormAccion accion={guardarBeca} className="grid gap-3">
              <label className="campo"><span>Alumno</span><select id="b-alumno" name="alumno" className="input">{als.map((a) => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre} · {curso(a.cursoId)}</option>)}</select></label>
              <label className="campo"><span>Porcentaje</span><input id="b-pct" name="porcentaje" type="number" min={1} max={100} defaultValue={25} className="input" /></label>
              <label className="campo"><span>Motivo</span><input id="b-motivo" name="motivo" className="input" placeholder="Hermanos, situación económica…" /></label>
              <Enviar>Guardar beca</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      )}
    </>
  );
}
