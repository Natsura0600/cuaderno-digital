import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todasLasMaterias, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { NOMBRE_ROL } from "@/components/navegacion";
import { Chip, Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { Importar } from "./Importar";
import {
  activar, altaAlumno, altaPersonal, bajaAlumno, desvincular, editarAlumno, editarUsuario, importarAlumnos, importarEquipo, resetClave, vincularFamilia,
} from "./acciones";

export const metadata = { title: "Comunidad" };

export default async function Usuarios({ searchParams }: PageProps<"/usuarios">) {
  const yo = await requerir("directivo");
  const sp = await searchParams;
  if (sp.tab === "cursos") redirect("/cursos");
  const tab = ["alumnos", "personal", "importar", "bajas"].includes(String(sp.tab)) ? String(sp.tab) : "alumnos";
  const [us, cursos, mats, als, fams] = await Promise.all([todosLosUsuarios(), todosLosCursos(), todasLasMaterias(), db.alumnos.todos(), db.familias.todos()]);
  const personal = us.filter((u) => u.rol !== "padre");
  const cursoSel = cursos.find((c) => c.id === Number(sp.curso)) ?? cursos[0];
  const q = String(sp.q ?? "").trim().toLowerCase();
  const activos = als.filter((a) => a.activo);
  const listaAlumnos = (q ? activos.filter((a) => `${a.apellido} ${a.nombre} ${a.dni}`.toLowerCase().includes(q)) : activos.filter((a) => a.cursoId === cursoSel?.id)).sort(
    (a, b) => a.apellido.localeCompare(b.apellido, "es") || a.nombre.localeCompare(b.nombre, "es"),
  );
  const nombreCurso = (id: number) => cursos.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <>
      <Encabezado
        titulo="Comunidad"
        bajada={`${activos.length} alumnos · ${us.filter((u) => u.rol === "padre").length} cuentas familiares · ${personal.length} personas del equipo`}
        acciones={<><Link href="/cursos" className="btn-sec">Cursos</Link><Link href="/materias" className="btn-sec">Materias y docentes</Link></>}
      />
      <Pestanas
        activo={tab}
        items={[
          { clave: "alumnos", texto: "Alumnos y familias", href: "/usuarios?tab=alumnos" },
          { clave: "personal", texto: "Equipo", href: "/usuarios?tab=personal" },
          { clave: "importar", texto: "Importar desde una planilla", href: "/usuarios?tab=importar" },
          { clave: "bajas", texto: "Bajas", href: "/usuarios?tab=bajas" },
        ]}
      />

      {tab === "alumnos" &&
        (!cursos.length ? (
          <Vacio titulo="Primero creá los cursos"><Link className="link" href="/cursos">Ir a Cursos</Link></Vacio>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <form action="/usuarios" className="mb-3 flex gap-2">
                <input type="hidden" name="tab" value="alumnos" />
                <label className="sr-only" htmlFor="q-al">Buscar alumno</label>
                <input id="q-al" name="q" defaultValue={q} placeholder="Buscar por apellido, nombre o DNI" className="input" />
                <button className="btn-sec">Buscar</button>
              </form>
              {!q && <Pestanas activo={cursoSel?.id} items={cursos.map((c) => ({ clave: c.id, texto: c.nombre, href: `/usuarios?tab=alumnos&curso=${c.id}` }))} />}
              {listaAlumnos.length === 0 ? (
                <Vacio titulo={q ? "No hay alumnos que coincidan" : `${cursoSel?.nombre} no tiene alumnos todavía`}>Agregalos con el formulario o importalos desde una planilla.</Vacio>
              ) : (
                <ul className="grid gap-2">
                  {listaAlumnos.map((a) => {
                    const fs = fams.filter((f) => f.alumnoId === a.id).map((f) => ({ f, p: us.find((u) => u.id === f.padreId) }));
                    return (
                      <li key={a.id}>
                        <details className="card">
                          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                            <span>
                              <strong>{a.apellido}, {a.nombre}</strong>{" "}
                              <span className="text-sm text-muted">· DNI {Number(a.dni).toLocaleString("es-AR")}{q ? ` · ${nombreCurso(a.cursoId)}` : ""}</span>
                            </span>
                            {fs.length ? <span className="text-sm text-muted">{fs.map((x) => nombreCompleto(x.p)).join(", ")}</span> : <Chip tono="aviso">Sin familia vinculada</Chip>}
                          </summary>
                          <div className="grid gap-4 border-t border-line p-3 md:grid-cols-2">
                            <FormAccion accion={editarAlumno.bind(null, a.id)} reiniciar={false} className="grid content-start gap-2 sm:grid-cols-2">
                              <p className="eyebrow sm:col-span-2">Datos del alumno</p>
                              <label className="campo"><span>Nombre</span><input name="nombre" defaultValue={a.nombre} className="input" /></label>
                              <label className="campo"><span>Apellido</span><input name="apellido" defaultValue={a.apellido} className="input" /></label>
                              <label className="campo"><span>DNI</span><input name="dni" defaultValue={a.dni} inputMode="numeric" className="input" /></label>
                              <label className="campo"><span>Nacimiento</span><input name="fechaNac" type="date" defaultValue={a.fechaNac ?? ""} className="input" /></label>
                              <label className="campo sm:col-span-2"><span>Curso</span><select name="curso" defaultValue={a.cursoId} className="input">{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                                <Enviar className="btn-sec">Guardar</Enviar>
                                <Confirmar mensaje="¿Dar de baja?" formAction={bajaAlumno.bind(null, a.id, false)}>Dar de baja</Confirmar>
                                <span className="text-xs text-muted">QR: <span className="tabular select-all">{a.codigoQr}</span></span>
                              </div>
                            </FormAccion>
                            <div className="grid content-start gap-2 text-sm">
                              <p className="eyebrow">Familia</p>
                              {fs.map(({ f, p }) => (
                                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-2">
                                  <span>{nombreCompleto(p)} ({f.vinculo})<span className="block select-all text-xs text-muted">{p?.email}{p?.telefono ? ` · ${p.telefono}` : ""}</span></span>
                                  <span className="flex flex-wrap gap-1">
                                    {p && <FormAccion accion={resetClave.bind(null, p.id)} reiniciar={false}><Enviar className="btn-sec btn-chico" pendiente="…">Nueva contraseña</Enviar></FormAccion>}
                                    <form action={desvincular.bind(null, f.id)}><Confirmar mensaje="¿Desvincular?" className="btn-sec btn-chico">Desvincular</Confirmar></form>
                                  </span>
                                </div>
                              ))}
                              <FormAccion accion={vincularFamilia.bind(null, a.id)} className="grid gap-2 sm:grid-cols-2">
                                <label className="campo"><span>E-mail del adulto</span><input name="email" type="email" className="input" /></label>
                                <label className="campo"><span>Vínculo</span><input name="vinculo" className="input" placeholder="Madre, padre, tutor…" /></label>
                                <label className="campo sm:col-span-2"><span>Nombre y apellido (si es una cuenta nueva)</span><input name="nombre" className="input" /></label>
                                <div className="sm:col-span-2"><Enviar className="btn-sec">Vincular</Enviar></div>
                              </FormAccion>
                            </div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                <p className="eyebrow mt-1">Adulto responsable (opcional)</p>
                <label className="campo"><span>E-mail (si ya tiene cuenta, se vincula)</span><input id="al-email" name="emailFamilia" type="email" className="input" /></label>
                <label className="campo"><span>Nombre y apellido</span><input id="al-fam" name="nombreFamilia" className="input" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="campo"><span>Teléfono</span><input id="al-tel" name="telefonoFamilia" className="input" /></label>
                  <label className="campo"><span>Vínculo</span><input id="al-vinc" name="vinculo" className="input" placeholder="Madre" /></label>
                </div>
                <p className="text-xs text-muted">La cuenta familiar nueva entra con el DNI del alumno como contraseña inicial y se le pide cambiarla.</p>
                <Enviar>Agregar alumno</Enviar>
              </FormAccion>
            </Seccion>
          </div>
        ))}

      {tab === "personal" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <ul className="grid min-w-0 content-start gap-2">
            {personal
              .sort((a, b) => a.rol.localeCompare(b.rol) || a.apellido.localeCompare(b.apellido))
              .map((p) => {
                const suyas = mats.filter((m) => m.profesorId === p.id);
                return (
                  <li key={p.id}>
                    <details className="card">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                        <span>
                          <strong>{p.apellido}, {p.nombre}</strong>
                          <span className="block text-sm text-muted">{p.cargo ?? NOMBRE_ROL[p.rol]} · {p.email}</span>
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <Chip tono="neutro">{NOMBRE_ROL[p.rol]}</Chip>
                          {p.rol === "profesor" && <Chip tono={suyas.length ? "marca" : "aviso"}>{suyas.length} materias</Chip>}
                          {!p.activo && <Chip tono="peligro">Inactivo</Chip>}
                          {p.debeCambiarClave && <Chip tono="oro">Clave inicial</Chip>}
                        </span>
                      </summary>
                      <div className="grid gap-3 border-t border-line p-3">
                        <FormAccion accion={editarUsuario.bind(null, p.id)} reiniciar={false} className="grid gap-2 sm:grid-cols-3">
                          <label className="campo"><span>Nombre</span><input name="nombre" defaultValue={p.nombre} className="input" /></label>
                          <label className="campo"><span>Apellido</span><input name="apellido" defaultValue={p.apellido} className="input" /></label>
                          <label className="campo"><span>E-mail</span><input name="email" type="email" defaultValue={p.email} className="input" /></label>
                          <label className="campo"><span>Rol</span>
                            <select name="rol" defaultValue={p.rol} className="input"><option value="profesor">Docente</option><option value="preceptor">Preceptoría</option><option value="directivo">Equipo directivo</option></select>
                          </label>
                          <label className="campo"><span>Cargo</span><input name="cargo" defaultValue={p.cargo ?? ""} className="input" /></label>
                          <label className="campo"><span>Teléfono</span><input name="telefono" defaultValue={p.telefono ?? ""} className="input" /></label>
                          <div className="flex flex-wrap gap-2 sm:col-span-3">
                            <Enviar className="btn-sec">Guardar</Enviar>
                            {p.rol === "profesor" && <Link href="/materias?vista=docentes" className="btn-sec">Asignar materias</Link>}
                          </div>
                        </FormAccion>
                        {p.id !== yo.id && (
                          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                            <FormAccion accion={resetClave.bind(null, p.id)} reiniciar={false}><Enviar className="btn-sec btn-chico" pendiente="…">Generar nueva contraseña</Enviar></FormAccion>
                            <form action={activar.bind(null, p.id, !p.activo)}><button className="btn-sec btn-chico">{p.activo ? "Desactivar cuenta" : "Reactivar cuenta"}</button></form>
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
          </ul>
          <Seccion titulo="Sumar al equipo" className="self-start">
            <FormAccion accion={altaPersonal} className="grid gap-3" reiniciar={false}>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Nombre</span><input id="pe-nombre" name="nombre" className="input" /></label>
                <label className="campo"><span>Apellido</span><input id="pe-apellido" name="apellido" className="input" /></label>
              </div>
              <label className="campo"><span>E-mail</span><input id="pe-email" name="email" type="email" className="input" /></label>
              <label className="campo"><span>Rol</span><select id="pe-rol" name="rol" className="input"><option value="profesor">Docente</option><option value="preceptor">Preceptoría</option><option value="directivo">Equipo directivo / secretaría</option></select></label>
              <label className="campo"><span>Cargo (opcional)</span><input id="pe-cargo" name="cargo" className="input" placeholder="Se completa solo con sus materias" /></label>
              <label className="campo"><span>Teléfono</span><input id="pe-tel" name="telefono" className="input" /></label>
              <Enviar>Crear cuenta</Enviar>
            </FormAccion>
          </Seccion>
        </div>
      )}

      {tab === "importar" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Seccion titulo="Importar alumnos y familias">
            <Importar
              accion={importarAlumnos}
              columnas="Apellido · Nombre · DNI · Curso · E-mail del responsable · Nombre del responsable · Teléfono · Vínculo"
              ejemplo={"Apellido\tNombre\tDNI\tCurso\tE-mail responsable\tNombre responsable\tTeléfono\tVínculo\nPérez\tLucía\t50123456\t1° A\tmaria.perez@correo.com\tMaría Pérez\t11 5555-1234\tMadre"}
              boton="Importar alumnos"
            />
            <p className="mt-3 text-xs text-muted">El curso tiene que existir con ese nombre (por ejemplo «1° A» o «3° grado B»). Las cuentas familiares nuevas entran con el DNI del alumno como contraseña inicial.</p>
          </Seccion>
          <Seccion titulo="Importar equipo (docentes, preceptores, directivos)">
            <Importar
              accion={importarEquipo}
              columnas="Apellido · Nombre · E-mail · Rol · Cargo · Teléfono"
              ejemplo={"Apellido\tNombre\tE-mail\tRol\tCargo\tTeléfono\nGómez\tValeria\tvgomez@correo.com\tdocente\t\t11 4444-0000"}
              boton="Importar equipo"
            />
            <p className="mt-3 text-xs text-muted">Rol: docente, preceptor o directivo. A cada cuenta se le genera una contraseña inicial que tiene que cambiar al entrar.</p>
          </Seccion>
        </div>
      )}

      {tab === "bajas" && (
        <Seccion titulo="Alumnos dados de baja o egresados">
          {als.filter((a) => !a.activo).length === 0 ? <Vacio titulo="No hay bajas" /> : (
            <ul className="grid gap-2 text-sm">
              {als.filter((a) => !a.activo).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span><strong>{a.apellido}, {a.nombre}</strong> <span className="text-muted">· DNI {Number(a.dni).toLocaleString("es-AR")} · último curso {nombreCurso(a.cursoId)}</span></span>
                  <form action={bajaAlumno.bind(null, a.id, true)}><button className="btn-sec btn-chico">Reincorporar</button></form>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
    </>
  );
}
