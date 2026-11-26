import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { PLANES } from "@/lib/materias";
import { Aviso, Chip, Encabezado, Pestanas, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { aplicarPlan, asignar, asignarDesdeDocente, copiarDeCurso, guardarCurso, nuevaMateria, quitarMateria } from "./acciones";

export const metadata = { title: "Materias y docentes" };

export default async function Materias({ searchParams }: PageProps<"/materias">) {
  await requerir("directivo");
  const sp = await searchParams;
  const vista = sp.vista === "docentes" ? "docentes" : "cursos";
  const [cursos, mats, us, hs] = await Promise.all([todosLosCursos(), db.materias.todos(), todosLosUsuarios(), db.horarios.todos()]);
  const profes = us.filter((u) => u.rol === "profesor" && u.activo).sort((a, b) => a.apellido.localeCompare(b.apellido));
  const sinDocente = mats.filter((m) => !m.profesorId);
  const curso = (id: number) => cursos.find((c) => c.id === id)?.nombre ?? "—";
  const capacidad = REGLAS.modulosPorDia * 5;

  if (!cursos.length)
    return (
      <>
        <Encabezado titulo="Materias y docentes" />
        <Vacio titulo="Primero creá los cursos">
          Andá a <Link className="link" href="/usuarios?tab=cursos">Comunidad → Cursos</Link> y creá los cursos del colegio (por ejemplo 1° A, 1° B, 2° A…).
        </Vacio>
      </>
    );

  return (
    <>
      <Encabezado
        titulo="Materias y docentes"
        bajada="Creá las materias de cada curso, indicá cuántas horas semanales tienen y asigná quién las dicta. Con eso se generan los horarios y cada docente ve sus cursos."
        acciones={<Link href="/horarios" className="btn-sec">Ir a horarios</Link>}
      />
      {sinDocente.length > 0 && (
        <div className="mb-4">
          <Aviso tono="aviso">
            Hay {sinDocente.length} materia{sinDocente.length > 1 ? "s" : ""} sin docente asignado:{" "}
            {sinDocente.slice(0, 6).map((m) => `${m.nombre} (${curso(m.cursoId)})`).join(", ")}
            {sinDocente.length > 6 ? "…" : ""}
          </Aviso>
        </div>
      )}
      <Pestanas
        activo={vista}
        items={[
          { clave: "cursos", texto: "Por curso", href: "/materias" },
          { clave: "docentes", texto: "Por docente", href: "/materias?vista=docentes" },
        ]}
      />

      {vista === "cursos" ? (
        (() => {
          const c = cursos.find((x) => x.id === Number(sp.curso)) ?? cursos[0];
          const delCurso = mats.filter((m) => m.cursoId === c.id).sort((a, b) => a.nombre.localeCompare(b.nombre));
          const total = delCurso.reduce((s, m) => s + m.horasSemanales, 0);
          return (
            <div className="grid gap-4">
              <div className="grid min-w-0 content-start gap-4">
                <Pestanas activo={c.id} items={cursos.map((x) => ({ clave: x.id, texto: x.nombre, href: `/materias?curso=${x.id}` }))} />
                <Seccion
                  titulo={`${c.nombre} · ${c.nivel}`}
                  acciones={<Chip tono={total > capacidad ? "peligro" : "marca"}>{total} de {capacidad} módulos semanales</Chip>}
                >
                  {total > capacidad && (
                    <div className="mb-3"><Aviso tono="peligro">La carga horaria supera los módulos disponibles por semana ({REGLAS.modulosPorDia} por día). Bajá horas o sumá módulos en Configuración.</Aviso></div>
                  )}
                  {delCurso.length === 0 ? (
                    <Vacio titulo={`${c.nombre} todavía no tiene materias`}>Usá un plan sugerido, copiá las de otro curso o creá una nueva.</Vacio>
                  ) : (
                    <FormAccion accion={guardarCurso.bind(null, c.id)} reiniciar={false}>
                      <TablaScroll>
                        <table className="tabla min-w-[760px] table-fixed">
                          <colgroup><col className="w-[28%]" /><col className="w-[20%]" /><col className="w-[26%]" /><col className="w-20" /><col className="w-24" /><col className="w-24" /></colgroup>
                          <thead>
                            <tr><th>Materia</th><th>Área</th><th>Docente</th><th>Horas</th><th title="Horas que ya ubicó el generador de horarios">Ubicadas</th><th></th></tr>
                          </thead>
                          <tbody>
                            {delCurso.map((m) => {
                              const ubicadas = hs.filter((h) => h.materiaId === m.id).length;
                              return (
                                <tr key={m.id}>
                                  <td><input name={`nombre-${m.id}`} defaultValue={m.nombre} aria-label="Nombre de la materia" className="input !py-1.5" /></td>
                                  <td><input name={`area-${m.id}`} defaultValue={m.area} aria-label="Área" className="input !py-1.5" /></td>
                                  <td>
                                    <select name={`profesor-${m.id}`} defaultValue={m.profesorId ?? ""} aria-label={`Docente de ${m.nombre}`} className={`input !py-1.5 ${m.profesorId ? "" : "!border-warn"}`}>
                                      <option value="">Sin asignar</option>
                                      {profes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
                                    </select>
                                  </td>
                                  <td><input name={`horas-${m.id}`} type="number" min={1} max={12} defaultValue={m.horasSemanales} aria-label="Horas semanales" className="input tabular !py-1.5" /></td>
                                  <td className="tabular"><Chip tono={ubicadas === m.horasSemanales ? "ok" : "aviso"}>{ubicadas}/{m.horasSemanales}</Chip></td>
                                  <td>
                                    <Confirmar mensaje="¿Borrar? Se pierden sus notas y planificaciones" className="btn-peligro btn-chico" formAction={quitarMateria.bind(null, m.id)}>
                                      Borrar
                                    </Confirmar>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </TablaScroll>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted">«Ubicadas» muestra cuántas horas ya puso el generador de horarios en la grilla.</p>
                        <Enviar>Guardar cambios de {c.nombre}</Enviar>
                      </div>
                    </FormAccion>
                  )}
                </Seccion>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <NuevaMateria cursos={cursos} profes={profes} cursoSel={c.id} />
                  <Seccion titulo="Usar un plan sugerido" className="self-start">
                    <FormAccion accion={aplicarPlan.bind(null, c.id)} className="grid gap-3">
                      <label className="campo">
                        <span>Plan</span>
                        <select name="plan" className="input" defaultValue={c.nivel === "primaria" ? "primaria" : c.anio === 1 ? "sec-basico-1" : c.anio <= 3 ? "sec-basico-23" : "sec-superior"}>
                          {PLANES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </label>
                      <p className="text-xs text-muted">Agrega solo las materias que falten. Después podés cambiar nombres y horas.</p>
                      <div><Enviar className="btn-sec">Agregar materias del plan</Enviar></div>
                    </FormAccion>
                  </Seccion>
                  <Seccion titulo="Copiar de otro curso" className="self-start">
                    <FormAccion accion={copiarDeCurso.bind(null, c.id)} className="grid gap-3">
                      <label className="campo">
                        <span>Copiar las materias de</span>
                        <select name="origen" className="input">
                          {cursos.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.nombre} ({mats.filter((m) => m.cursoId === x.id).length} materias)</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="conDocentes" className="size-4 accent-[var(--brand)]" /> También copiar los docentes</label>
                      <div><Enviar className="btn-sec">Copiar a {c.nombre}</Enviar></div>
                    </FormAccion>
                  </Seccion>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-w-0 content-start gap-3">
            {profes.length === 0 && <Vacio titulo="No hay docentes cargados">Sumalos en <Link className="link" href="/usuarios?tab=personal">Comunidad → Equipo</Link>.</Vacio>}
            {profes.map((p) => {
              const suyas = mats.filter((m) => m.profesorId === p.id).sort((a, b) => curso(a.cursoId).localeCompare(curso(b.cursoId)));
              const horas = suyas.reduce((s, m) => s + m.horasSemanales, 0);
              return (
                <Seccion key={p.id} titulo={<span>{nombreCompleto(p)} <span className="block text-sm font-normal text-muted">{p.email}</span></span>} acciones={<Chip tono={horas ? "marca" : "aviso"}>{horas} módulos semanales</Chip>}>
                  {suyas.length === 0 ? (
                    <p className="mb-3 text-sm text-muted">Todavía no tiene materias asignadas.</p>
                  ) : (
                    <ul className="mb-3 flex flex-wrap gap-2">
                      {suyas.map((m) => (
                        <li key={m.id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm">
                          <span><strong>{curso(m.cursoId)}</strong> · {m.nombre} · {m.horasSemanales} h</span>
                          <form action={asignar.bind(null, m.id, null)}>
                            <button className="grid size-6 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad" aria-label={`Quitar ${m.nombre} de ${curso(m.cursoId)}`}>×</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sinDocente.length > 0 && (
                    <details>
                      <summary className="link cursor-pointer text-sm">Asignarle materias sin docente</summary>
                      <FormAccion accion={asignarDesdeDocente.bind(null, p.id)} className="mt-3 grid gap-2">
                        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                          {sinDocente.map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="materias" value={m.id} className="size-4 accent-[var(--brand)]" />
                              {curso(m.cursoId)} · {m.nombre}
                            </label>
                          ))}
                        </div>
                        <div><Enviar className="btn-sec">Asignar a {p.nombre}</Enviar></div>
                      </FormAccion>
                    </details>
                  )}
                </Seccion>
              );
            })}
          </div>
          <NuevaMateria cursos={cursos} profes={profes} />
        </div>
      )}
    </>
  );
}

function NuevaMateria({ cursos, profes, cursoSel }: { cursos: { id: number; nombre: string }[]; profes: { id: number; nombre: string; apellido: string }[]; cursoSel?: number }) {
  return (
    <Seccion titulo="Nueva materia" className="self-start">
      <FormAccion accion={nuevaMateria} className="grid gap-3">
        <label className="campo"><span>Nombre</span><input id="nm-nombre" name="nombre" className="input" placeholder="Ej. Físico-Química" required /></label>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <label className="campo"><span>Área (opcional)</span><input id="nm-area" name="area" className="input" placeholder="Ciencias Naturales" /></label>
          <label className="campo"><span>Horas</span><input id="nm-horas" name="horas" type="number" min={1} max={12} defaultValue={2} className="input" /></label>
        </div>
        <fieldset className="campo">
          <span>En qué cursos</span>
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-line p-3">
            {cursos.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="cursos" value={c.id} defaultChecked={c.id === cursoSel} className="size-4 accent-[var(--brand)]" />
                {c.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="campo">
          <span>Docente (opcional)</span>
          <select id="nm-prof" name="profesor" className="input">
            <option value="">Lo asigno después</option>
            {profes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
          </select>
        </label>
        <Enviar>Crear materia</Enviar>
      </FormAccion>
    </Seccion>
  );
}
