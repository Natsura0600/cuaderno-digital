import Link from "next/link";
import { db, ESTADOS_SOLICITUD } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, todosLosCursos } from "@/lib/alcance";
import { fCorta, hoy } from "@/lib/fechas";
import { ESTADO_SOL } from "@/lib/matricula";
import { Chip, Dato, Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { cambiarEstado, darDeAlta, reinscribir } from "./acciones";

export const metadata = { title: "Matrícula" };

export default async function Matricula({ searchParams }: PageProps<"/matricula">) {
  const u = await requerir("padre", "directivo");
  const sp = await searchParams;
  const ciclo = Number(hoy().slice(0, 4)) + 1;

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    const sols = await db.solicitudes.todos((s) => s.padreId === u.id || hijos.some((h) => h.id === s.alumnoId));
    return (
      <>
        <Encabezado titulo="Matrícula" bajada={`Reinscripción para el ciclo lectivo ${ciclo}.`} acciones={<Link href="/inscripcion" className="btn-sec">Inscribir a un hermano o hermana</Link>} />
        <div className="grid gap-3 md:grid-cols-2">
          {hijos.map((h) => {
            const s = sols.find((x) => x.alumnoId === h.id && x.cicloLectivo === ciclo);
            return (
              <Seccion key={h.id} titulo={`${h.nombre} · ${h.curso}`}>
                {s ? (
                  <>
                    <p className="flex flex-wrap items-center gap-2">Reinscripción {ciclo}: <Chip tono={ESTADO_SOL[s.estado].tono}>{ESTADO_SOL[s.estado].texto}</Chip></p>
                    <p className="mt-2 text-sm text-muted">{ESTADO_SOL[s.estado].ayuda}</p>
                    {s.observaciones && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{s.observaciones}</p>}
                  </>
                ) : (
                  <form action={reinscribir.bind(null, h.id)} className="grid gap-2">
                    <p className="text-sm text-muted">Todavía no reinscribiste a {h.nombre} para {ciclo}.</p>
                    <div><Enviar pendiente="Enviando…">Reinscribir para {ciclo}</Enviar></div>
                  </form>
                )}
              </Seccion>
            );
          })}
        </div>
      </>
    );
  }

  const [sols, cursos] = await Promise.all([db.solicitudes.todos(), todosLosCursos()]);
  const filtro = String(sp.estado ?? "pendientes");
  const lista = sols
    .filter((s) => (filtro === "pendientes" ? !["aceptada", "rechazada"].includes(s.estado) : filtro === "todas" ? true : s.estado === filtro))
    .sort((a, b) => b.creado.localeCompare(a.creado));
  const delCiclo = sols.filter((s) => s.cicloLectivo === ciclo);
  return (
    <>
      <Encabezado titulo="Matrícula" bajada={`Solicitudes de inscripción y reinscripción · ciclo ${ciclo}. Formulario público: /inscripcion`} acciones={<Link href="/inscripcion" className="btn-sec" target="_blank">Ver formulario público</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Nuevas" valor={delCiclo.filter((s) => s.tipo === "nueva").length} />
        <Dato etiqueta="Reinscripciones" valor={delCiclo.filter((s) => s.tipo === "reinscripcion").length} />
        <Dato etiqueta="Para revisar" valor={delCiclo.filter((s) => ["recibida", "en_revision"].includes(s.estado)).length} tono="aviso" />
        <Dato etiqueta="Aceptadas" valor={delCiclo.filter((s) => s.estado === "aceptada").length} tono="ok" />
      </div>
      <Pestanas activo={filtro} items={[{ clave: "pendientes", texto: "Pendientes", href: "/matricula" }, ...ESTADOS_SOLICITUD.map((e) => ({ clave: e, texto: ESTADO_SOL[e].texto, href: `/matricula?estado=${e}` })), { clave: "todas", texto: "Todas", href: "/matricula?estado=todas" }]} />
      {lista.length === 0 ? <Vacio titulo="No hay solicitudes en este estado" /> : (
        <ul className="grid gap-2">
          {lista.map((s) => (
            <li key={s.id}>
              <details className="card">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
                  <span>
                    <strong>{s.alumnoApellido}, {s.alumnoNombre}</strong>
                    <span className="block text-sm text-muted">{s.tipo === "nueva" ? "Ingreso" : "Reinscripción"} a {s.anio}° año · {s.codigo} · {fCorta(s.creado.slice(0, 10))}</span>
                  </span>
                  <Chip tono={ESTADO_SOL[s.estado].tono}>{ESTADO_SOL[s.estado].texto}</Chip>
                </summary>
                <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted">DNI</dt><dd>{Number(s.alumnoDni).toLocaleString("es-AR")}</dd>
                    <dt className="text-muted">Nacimiento</dt><dd>{s.alumnoFechaNac ? fCorta(s.alumnoFechaNac) + " " + s.alumnoFechaNac.slice(0, 4) : "—"}</dd>
                    <dt className="text-muted">Procedencia</dt><dd>{s.escuelaAnterior ?? "—"}</dd>
                    <dt className="text-muted">Responsable</dt><dd>{s.tutorNombre}</dd>
                    <dt className="text-muted">Contacto</dt><dd className="select-all break-all">{s.tutorEmail} · {s.tutorTelefono}</dd>
                    {s.comentarios && <><dt className="text-muted">Comentarios</dt><dd>{s.comentarios}</dd></>}
                    <dt className="text-muted">Documentos</dt>
                    <dd>{s.documentos.length ? <ul>{s.documentos.map((d) => <li key={d.archivo}><a className="link" href={`/archivos/${d.archivo}`} target="_blank" rel="noopener">{d.nombre}</a></li>)}</ul> : "Ninguno"}</dd>
                  </dl>
                  <div className="grid content-start gap-4">
                    <FormAccion accion={cambiarEstado.bind(null, s.id)} className="grid gap-2" reiniciar={false}>
                      <label className="campo"><span>Estado</span><select name="estado" defaultValue={s.estado} className="input">{ESTADOS_SOLICITUD.map((e) => <option key={e} value={e}>{ESTADO_SOL[e].texto}</option>)}</select></label>
                      <label className="campo"><span>Observaciones para la familia</span><textarea name="observaciones" rows={2} defaultValue={s.observaciones ?? ""} className="input" /></label>
                      <div><Enviar className="btn-sec">Actualizar</Enviar></div>
                    </FormAccion>
                    {s.estado === "aceptada" && !s.alumnoId && (
                      <FormAccion accion={darDeAlta.bind(null, s.id)} className="grid gap-2 rounded-xl bg-ok-soft p-3" reiniciar={false}>
                        <label className="campo"><span>Asignar al curso</span><select name="curso" className="input">{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                        <div><Enviar>Dar de alta y crear cuenta de la familia</Enviar></div>
                      </FormAccion>
                    )}
                    {s.alumnoId && <Chip tono="ok">Alumno dado de alta</Chip>}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
