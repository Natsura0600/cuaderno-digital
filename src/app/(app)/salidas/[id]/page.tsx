import { notFound } from "next/navigation";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe, nombreCompleto, todosLosUsuarios } from "@/lib/alcance";
import { fFechaHoraMin, fLarga, hoy, pesos } from "@/lib/fechas";
import { Aviso, Chip, Dato, Encabezado, Seccion, TablaScroll } from "@/components/ui";
import { Enviar } from "@/components/formularios";
import { marcarPago, recordarSalida, responder } from "../acciones";

export const metadata = { title: "Salida" };

export default async function Salida({ params }: PageProps<"/salidas/[id]">) {
  const u = await requerir();
  const id = Number((await params).id);
  const s = await db.salidas.uno(id);
  if (!s || !(await cursosDe(u)).some((c) => c.id === s.cursoId)) notFound();
  const [auts, us, als] = await Promise.all([db.autorizaciones.todos(id), todosLosUsuarios(), alumnosDeCursos([s.cursoId])]);
  const curso = (await cursosDe(u)).find((c) => c.id === s.cursoId)!;
  const cabecera = (
    <Seccion>
      <p >{fLarga(s.fecha)} · sale {s.horaSalida} · regresa {s.horaRegreso}</p>
      <p className="mt-1 text-muted">{s.destino} · {curso.nombre} · {s.costo ? `Costo ${pesos(s.costo)}` : "Sin costo"}</p>
      {s.descripcion && <p className="mt-3">{s.descripcion}</p>}
      <p className="mt-3 text-sm"><span className="text-muted">Responsables:</span> {s.responsables.map((r) => { const x = us.find((y) => y.id === r); return `${nombreCompleto(x)} (${x?.cargo ?? ""})`; }).join(", ")}</p>
    </Seccion>
  );

  if (u.rol === "padre") {
    const hijos = (await hijosDe(u.id)).filter((h) => h.cursoId === s.cursoId);
    return (
      <>
        <Encabezado titulo={s.titulo} volver={{ href: "/salidas", texto: "Salidas" }} />
        <div className="grid gap-4 lg:grid-cols-2">
          {cabecera}
          <Seccion titulo="Autorización">
            {hijos.map((h) => {
              const a = auts[h.id];
              return (
                <div key={h.id} className="mb-4 rounded-xl border border-line p-4">
                  <p className="font-semibold">{h.nombre} {h.apellido}</p>
                  {a?.firmado ? (
                    <p className="mt-2">
                      <Chip tono={a.autorizado ? "ok" : "peligro"}>{a.autorizado ? "Autorizado" : "No autorizado"}</Chip>{" "}
                      <span className="text-sm text-muted">el {fFechaHoraMin(new Date(a.firmado))}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Todavía no respondiste.</p>
                  )}
                  {s.fecha >= hoy() && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={responder.bind(null, id, h.id, true)}><Enviar className={a?.autorizado ? "btn-sec" : "btn-prim"} pendiente="Enviando…">Autorizo</Enviar></form>
                      <form action={responder.bind(null, id, h.id, false)}><Enviar className="btn-sec" pendiente="Enviando…">No autorizo</Enviar></form>
                    </div>
                  )}
                  {s.costo > 0 && (
                    <p className="mt-3 text-sm">{a?.pagado ? <Chip tono="ok">Pago registrado</Chip> : <>Pago pendiente: {pesos(s.costo)}. Abonalo en secretaría o por transferencia y el colegio lo registra.</>}</p>
                  )}
                </div>
              );
            })}
          </Seccion>
        </div>
      </>
    );
  }

  const filas = als.map((a) => ({ a, r: auts[a.id] ?? null }));
  const autorizados = filas.filter((f) => f.r?.autorizado);
  const gestiona = u.rol === "directivo" || s.responsables.includes(u.id) || u.rol === "preceptor";
  return (
    <>
      <Encabezado
        titulo={s.titulo}
        volver={{ href: "/salidas", texto: "Salidas" }}
        acciones={gestiona && filas.some((f) => !f.r?.firmado) ? <form action={recordarSalida.bind(null, id)}><Enviar className="btn-sec" pendiente="Enviando…">Recordar a quienes faltan</Enviar></form> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Van" valor={autorizados.length} detalle={`de ${filas.length} alumnos`} tono="ok" />
        <Dato etiqueta="Sin responder" valor={filas.filter((f) => !f.r?.firmado).length} tono={filas.some((f) => !f.r?.firmado) ? "aviso" : undefined} />
        <Dato etiqueta="No autorizados" valor={filas.filter((f) => f.r?.firmado && !f.r.autorizado).length} />
        <Dato etiqueta="Pagos" valor={s.costo ? `${filas.filter((f) => f.r?.pagado).length}/${autorizados.length}` : "—"} detalle={s.costo ? pesos(s.costo) : "Sin costo"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1.3fr]">
        <div className="grid content-start gap-4">
          {cabecera}
          {autorizados.length > 0 && (
            <Seccion titulo={`Lista de asistentes (${autorizados.length})`}>
              <ol className="list-decimal pl-5 text-sm">{autorizados.map((f) => <li key={f.a.id}>{f.a.apellido}, {f.a.nombre} · DNI {Number(f.a.dni).toLocaleString("es-AR")}</li>)}</ol>
            </Seccion>
          )}
        </div>
        <Seccion titulo="Autorizaciones y pagos">
          {s.fecha < hoy() && <div className="mb-3"><Aviso>Esta salida ya se realizó.</Aviso></div>}
          <TablaScroll>
            <table className="tabla">
              <thead><tr><th>Alumno</th><th>Autorización</th>{s.costo > 0 && <th>Pago</th>}</tr></thead>
              <tbody>
                {filas.map(({ a, r }) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{a.apellido}, {a.nombre}</td>
                    <td>{!r?.firmado ? <Chip tono="aviso">Sin responder</Chip> : r.autorizado ? <Chip tono="ok">Autorizado</Chip> : <Chip tono="peligro">No autorizado</Chip>}</td>
                    {s.costo > 0 && (
                      <td>
                        {gestiona ? (
                          <form action={marcarPago.bind(null, id, a.id, !r?.pagado)}>
                            <button className={`btn-chico ${r?.pagado ? "btn-sec" : "btn-sec"}`}>{r?.pagado ? "✓ Pagó" : "Registrar pago"}</button>
                          </form>
                        ) : r?.pagado ? <Chip tono="ok">Pagó</Chip> : <Chip>Pendiente</Chip>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </Seccion>
      </div>
    </>
  );
}
