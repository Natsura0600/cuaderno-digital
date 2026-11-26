import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todasLasMaterias, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { NOMBRE_ROL } from "@/components/navegacion";
import { Chip, Encabezado, Pestanas, Seccion, TablaScroll } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import {
  activar, altaAlumno, altaCurso, altaMateria, altaPersonal, asignarDocente, asignarPreceptor, bajaAlumno, cambiarCurso, resetClave, vincularFamilia,
} from "./acciones";

export const metadata = { title: "Comunidad" };

export default async function Usuarios({ searchParams }: PageProps<"/usuarios">) {
  const yo = await requerir("directivo");
  const sp = await searchParams;
  const tab = String(sp.tab ?? "alumnos");
  const [us, cursos, mats, als, fams] = await Promise.all([todosLosUsuarios(), todosLosCursos(), todasLasMaterias(), db.alumnos.todos(), db.familias.todos()]);
  const personal = us.filter((u) => u.rol !== "padre");
  const profes = us.filter((u) => u.rol === "profesor" && u.activo);
  const precs = us.filter((u) => u.rol === "preceptor" && u.activo);
  const cursoSel = cursos.find((c) => c.id === Number(sp.curso)) ?? cursos[0];

  return (
    <>
      <Encabezado titulo="Comunidad" bajada={`${als.filter((a) => a.activo).length} alumnos · ${us.filter((u) => u.rol === "padre").length} cuentas familiares · ${personal.length} personas del equipo`} />
      <Pestanas activo={tab} items={[
        { clave: "alumnos", texto: "Alumnos y familias", href: "/usuarios?tab=alumnos" },
        { clave: "personal", texto: "Equipo", href: "/usuarios?tab=personal" },
        { clave: "cursos", texto: "Cursos y materias", href: "/usuarios?tab=cursos" },
      ]} />

      {tab === "alumnos" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <Pestanas activo={cursoSel?.id} items={cursos.map((c) => ({ clave: c.id, texto: c.nombre, href: `/usuarios?tab=alumnos&curso=${c.id}` }))} />
            <ul className="grid gap-2">
              {als.filter((a) => a.cursoId === cursoSel?.id && a.activo).sort((a, b) => a.apellido.localeCompare(b.apellido)).map((a) => {
                const fs = fams.filter((f) => f.alumnoId === a.id).map((f) => ({ f, p: us.find((u) => u.id === f.padreId) }));
                return (
                  <li key={a.id}>
                    <details className="card">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                        <span><strong>{a.apellido}, {a.nombre}</strong> <span className="text-sm text-muted">· DNI {Number(a.dni).toLocaleString("es-AR")}</span></span>
                        <span className="text-sm text-muted">{fs.map((x) => nombreCompleto(x.p)).join(", ") || "Sin familia vinculada"}</span>
                      </summary>
                      <div className="grid gap-4 border-t border-line p-3 md:grid-cols-2">
                        <div className="grid content-start gap-2 text-sm">
                          <p className="eyebrow">Familia</p>
                          {fs.map(({ f, p }) => (
                            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-2">
                              <span>{nombreCompleto(p)} ({f.vinculo})<span className="block select-all text-xs text-muted">{p?.email}{p?.telefono ? ` · ${p.telefono}` : ""}</span></span>
                              {p && <FormAccion accion={resetClave.bind(null, p.id)} reiniciar={false}><Enviar className="btn-sec btn-chico" pendiente="…">Nueva contraseña</Enviar></FormAccion>}
                            </div>
                          ))}
                          <FormAccion accion={vincularFamilia.bind(null, a.id)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_1fr_auto] sm:items-end">
                            <label className="campo"><span>Vincular e-mail</span><input name="email" type="email" className="input" /></label>
                            <label className="campo"><span>Vínculo</span><input name="vinculo" className="input" placeholder="Madre, padre, tutor…" /></label>
                            <Enviar className="btn-sec">Vincular</Enviar>
                          </FormAccion>
                        </div>
                        <div className="grid content-start gap-3">
                          <FormAccion accion={cambiarCurso.bind(null, a.id)} className="flex flex-wrap items-end gap-2" reiniciar={false}>
                            <label className="campo"><span>Curso</span><select name="curso" defaultValue={a.cursoId} className="input">{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                            <Enviar className="btn-sec">Cambiar</Enviar>
                          </FormAccion>
                          <p className="text-xs text-muted">Credencial QR: <span className="tabular select-all">{a.codigoQr}</span></p>
                          <form action={bajaAlumno.bind(null, a.id)}><Confirmar mensaje="¿Dar de baja al alumno?">Dar de baja</Confirmar></form>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
          <Seccion titulo="Agregar alumno" className="self-start">
            <FormAccion accion={altaAlumno} className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Nombre</span><input id="al-nombre" name="nombre" className="input" /></label>
                <label className="campo"><span>Apellido</span><input id="al-apellido" name="apellido" className="input" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>DNI</span><input id="al-dni" name="dni" inputMode="numeric" className="input" /></label>
                <label className="campo"><span>Curso</span><select id="al-curso" name="curso" defaultValue={cursoSel?.id} className="input">{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
              </div>
              <label className="campo"><span>Nacimiento</span><input id="al-nac" name="fechaNac" type="date" className="input" /></label>
              <p className="eyebrow mt-1">Adulto responsable</p>
              <label className="campo"><span>E-mail (si ya tiene cuenta, se vincula)</span><input id="al-email" name="emailFamilia" type="email" className="input" /></label>
              <label className="campo"><span>Nombre y apellido</span><input id="al-fam" name="nombreFamilia" className="input" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Teléfono</span><input id="al-tel" name="telefonoFamilia" className="input" /></label>
                <label className="campo"><span>Vínculo</span><input id="al-vinc" name="vinculo" className="input" placeholder="Madre" /></label>
              </div>
              <Enviar>Agregar alumno</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      )}

      {tab === "personal" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Seccion>
            <TablaScroll>
              <table className="tabla">
                <thead><tr><th>Nombre</th><th>Rol</th><th>E-mail</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {personal.sort((a, b) => a.rol.localeCompare(b.rol) || a.apellido.localeCompare(b.apellido)).map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap font-medium">{nombreCompleto(p)}<span className="block text-xs font-normal text-muted">{p.cargo}</span></td>
                      <td>{NOMBRE_ROL[p.rol]}</td>
                      <td className="select-all text-muted">{p.email}</td>
                      <td>{p.activo ? <Chip tono="ok">Activo</Chip> : <Chip>Inactivo</Chip>}</td>
                      <td className="whitespace-nowrap">
                        {p.id !== yo.id && (
                          <div className="flex flex-wrap gap-1">
                            <FormAccion accion={resetClave.bind(null, p.id)} reiniciar={false}><Enviar className="btn-sec btn-chico" pendiente="…">Nueva contraseña</Enviar></FormAccion>
                            <form action={activar.bind(null, p.id, !p.activo)}><button className="btn-sec btn-chico">{p.activo ? "Desactivar" : "Activar"}</button></form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </Seccion>
          <Seccion titulo="Sumar al equipo" className="self-start">
            <FormAccion accion={altaPersonal} className="grid gap-3" reiniciar={false}>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Nombre</span><input id="pe-nombre" name="nombre" className="input" /></label>
                <label className="campo"><span>Apellido</span><input id="pe-apellido" name="apellido" className="input" /></label>
              </div>
              <label className="campo"><span>E-mail</span><input id="pe-email" name="email" type="email" className="input" /></label>
              <label className="campo"><span>Rol</span><select id="pe-rol" name="rol" className="input"><option value="profesor">Docente</option><option value="preceptor">Preceptoría</option><option value="directivo">Equipo directivo / secretaría</option></select></label>
              <label className="campo"><span>Cargo</span><input id="pe-cargo" name="cargo" className="input" placeholder="Docente de Química" /></label>
              <label className="campo"><span>Teléfono</span><input id="pe-tel" name="telefono" className="input" /></label>
              <Enviar>Crear cuenta</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      )}

      {tab === "cursos" && cursoSel && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <Pestanas activo={cursoSel.id} items={cursos.map((c) => ({ clave: c.id, texto: c.nombre, href: `/usuarios?tab=cursos&curso=${c.id}` }))} />
            <Seccion titulo={`${cursoSel.nombre} · ${cursoSel.nivel} · turno ${cursoSel.turno}`}>
              <FormAccion accion={asignarPreceptor.bind(null, cursoSel.id)} className="mb-4 flex flex-wrap items-end gap-2" reiniciar={false}>
                <label className="campo"><span>Preceptor/a</span><select name="preceptor" defaultValue={cursoSel.preceptorId ?? ""} className="input"><option value="">Sin asignar</option>{precs.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select></label>
                <Enviar className="btn-sec">Guardar</Enviar>
              </FormAccion>
              <ul className="grid gap-2">
                {mats.filter((m) => m.cursoId === cursoSel.id).map((m) => (
                  <li key={m.id} className="rounded-xl border border-line p-3">
                    <FormAccion accion={asignarDocente.bind(null, m.id)} className="flex flex-wrap items-end gap-2" reiniciar={false}>
                      <p className="min-w-40 flex-1 font-semibold">{m.nombre}<span className="block text-xs font-normal text-muted">{m.area}</span></p>
                      <label className="campo"><span>Docente</span><select name="profesor" defaultValue={m.profesorId ?? ""} className="input"><option value="">Sin asignar</option>{profes.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select></label>
                      <label className="campo w-20"><span>Horas</span><input name="horas" type="number" min={1} max={10} defaultValue={m.horasSemanales} className="input" /></label>
                      <Enviar className="btn-sec">Guardar</Enviar>
                    </FormAccion>
                  </li>
                ))}
              </ul>
              <FormAccion accion={altaMateria.bind(null, cursoSel.id)} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_1fr_1fr_80px_auto] sm:items-end">
                <label className="campo"><span>Nueva materia</span><input name="nombre" className="input" /></label>
                <label className="campo"><span>Área</span><input name="area" className="input" /></label>
                <label className="campo"><span>Docente</span><select name="profesor" className="input"><option value="">Sin asignar</option>{profes.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select></label>
                <label className="campo"><span>Horas</span><input name="horas" type="number" min={1} max={10} defaultValue={2} className="input" /></label>
                <Enviar className="btn-sec">Agregar</Enviar>
              </FormAccion>
            </Seccion>
          </div>
          <Seccion titulo="Nuevo curso" className="self-start">
            <FormAccion accion={altaCurso} className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Año / grado</span><input id="cu-anio" name="anio" type="number" min={1} max={7} defaultValue={5} className="input" /></label>
                <label className="campo"><span>División</span><input id="cu-div" name="division" defaultValue="A" className="input" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Nivel</span><select id="cu-nivel" name="nivel" className="input" defaultValue="secundaria"><option value="inicial">Inicial</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label>
                <label className="campo"><span>Turno</span><select id="cu-turno" name="turno" className="input"><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select></label>
              </div>
              <label className="campo"><span>Preceptor/a</span><select id="cu-prec" name="preceptor" className="input"><option value="">Sin asignar</option>{precs.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select></label>
              <Enviar>Crear curso</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      )}
    </>
  );
}
