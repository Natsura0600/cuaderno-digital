import { notFound } from "next/navigation";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, puedeVerAlumno, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { fFechaHora, fLarga } from "@/lib/fechas";
import { CATEGORIAS_INCIDENTE } from "@/lib/protocolos";
import { Chip, Encabezado, Seccion } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { agregarSeguimiento } from "../acciones";

export const metadata = { title: "Caso de convivencia" };

export default async function Caso({ params }: PageProps<"/convivencia/[id]">) {
  const u = await requerir("profesor", "preceptor", "directivo");
  const id = Number((await params).id);
  const r = await db.convivencia.uno(id);
  if (!r || !(await puedeVerAlumno(u, r.alumnoId))) notFound();
  const [a, segs, us, cursos] = await Promise.all([db.alumnos.uno(r.alumnoId), db.seguimientos.todos((s) => s.registroId === id), todosLosUsuarios(), todosLosCursos()]);
  const pasos = r.tipo === "incidente" ? CATEGORIAS_INCIDENTE[r.categoria]?.pasos ?? [] : [];
  const hechos = new Set(segs.map((s) => s.pasoProtocolo).filter(Boolean));
  return (
    <>
      <Encabezado
        titulo={`${a?.nombre} ${a?.apellido} · ${r.categoria}`}
        bajada={<span>{fLarga(r.fecha)} · {cursos.find((c) => c.id === a?.cursoId)?.nombre} · registrado por {nombreCompleto(us.find((x) => x.id === r.autorId))}</span>}
        volver={{ href: "/convivencia", texto: "Bitácora" }}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-4">
          <Seccion>
            <div className="mb-3 flex flex-wrap gap-2">
              {r.tipo === "reconocimiento" ? <Chip tono="ok">Reconocimiento</Chip> : <Chip tono={r.gravedad === "grave" ? "peligro" : r.gravedad === "moderada" ? "aviso" : "neutro"}>Gravedad {r.gravedad}</Chip>}
              <Chip tono="info">{r.estado.replace("_", " ")}</Chip>
              {!r.visibleFamilia && <Chip tono="aviso">Confidencial: la familia no lo ve</Chip>}
            </div>
            <p className="whitespace-pre-line">{r.descripcion}</p>
          </Seccion>
          <Seccion titulo="Seguimiento">
            {segs.length === 0 ? <p className="text-sm text-muted">Todavía no hay intervenciones registradas.</p> : (
              <ol className="relative grid gap-4 border-l-2 border-line pl-5">
                {segs.map((s) => (
                  <li key={s.id} className="relative">
                    <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-brand" aria-hidden />
                    <p className="text-sm">{s.nota}</p>
                    <p className="text-xs text-muted">{nombreCompleto(us.find((x) => x.id === s.autorId))} · {fFechaHora(new Date(s.creado))}{s.pasoProtocolo ? ` · paso ${s.pasoProtocolo}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
            {r.tipo === "incidente" && (
              <FormAccion accion={agregarSeguimiento.bind(null, id)} className="mt-5 grid gap-3 border-t border-line pt-4">
                <label className="campo"><span>Intervención</span><textarea id="s-nota" name="nota" rows={2} className="input" required /></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="campo">
                    <span>Paso del protocolo</span>
                    <select id="s-paso" name="paso" className="input" defaultValue={pasos.findIndex((_, i) => !hechos.has(i + 1)) + 1 || ""}>
                      <option value="">Ninguno</option>
                      {pasos.map((p, i) => <option key={i} value={i + 1}>{i + 1}. {p}</option>)}
                    </select>
                  </label>
                  <label className="campo">
                    <span>Estado del caso</span>
                    <select id="s-estado" name="estado" className="input" defaultValue={r.estado === "abierto" ? "en_seguimiento" : r.estado}>
                      <option value="abierto">Abierto</option>
                      <option value="en_seguimiento">En seguimiento</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </label>
                </div>
                <div><Enviar>Agregar seguimiento</Enviar></div>
              </FormAccion>
            )}
          </Seccion>
        </div>
        {pasos.length > 0 && (
          <Seccion titulo="Protocolo de actuación" className="self-start">
            <ol className="grid gap-2">
              {pasos.map((p, i) => (
                <li key={i} className={`flex gap-3 rounded-xl p-2.5 text-sm ${hechos.has(i + 1) ? "bg-ok-soft" : "bg-surface-2"}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${hechos.has(i + 1) ? "bg-ok text-white" : "border border-line"}`}>{hechos.has(i + 1) ? "✓" : i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </Seccion>
        )}
      </div>
    </>
  );
}
