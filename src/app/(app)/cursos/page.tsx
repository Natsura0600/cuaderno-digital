import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { nombreCompleto, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { NIVELES } from "@/lib/cursos";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { crearCursos, editarCurso, eliminarCurso } from "./acciones";

export const metadata = { title: "Cursos" };

export default async function Cursos() {
  await requerir("directivo");
  const [cursos, us, alumnos, mats] = await Promise.all([todosLosCursos(), todosLosUsuarios(), db.alumnos.todos((a) => a.activo), db.materias.todos()]);
  const precs = us.filter((u) => u.rol === "preceptor" && u.activo);

  return (
    <>
      <Encabezado
        titulo="Cursos"
        bajada="Creá los cursos de cada nivel y asigná su preceptor/a. Después cargá las materias y los alumnos."
        acciones={<><Link href="/materias" className="btn-sec">Materias y docentes</Link><Link href="/usuarios?tab=alumnos" className="btn-sec">Alumnos</Link></>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-4">
          {cursos.length === 0 && <Vacio titulo="Todavía no hay cursos">Usá el formulario para crearlos. Podés crear todos los de un nivel de una sola vez.</Vacio>}
          {NIVELES.filter((n) => cursos.some((c) => c.nivel === n.id)).map((n) => (
            <Seccion key={n.id} titulo={n.texto}>
              <ul className="grid gap-2">
                {cursos.filter((c) => c.nivel === n.id).map((c) => {
                  const nAl = alumnos.filter((a) => a.cursoId === c.id).length;
                  const ms = mats.filter((m) => m.cursoId === c.id);
                  return (
                    <li key={c.id}>
                      <details className="rounded-xl border border-line">
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3">
                          <span className="font-display text-lg font-bold">{c.nombre} <span className="text-sm font-normal text-muted">· turno {c.turno}</span></span>
                          <span className="flex flex-wrap gap-1.5">
                            <Chip tono={nAl ? "marca" : "neutro"}>{nAl} alumno{nAl === 1 ? "" : "s"}</Chip>
                            <Chip tono={ms.length ? "marca" : "aviso"}>{ms.length} materia{ms.length === 1 ? "" : "s"}</Chip>
                            <Chip tono={c.preceptorId ? "neutro" : "aviso"}>{c.preceptorId ? nombreCompleto(us.find((u) => u.id === c.preceptorId)) : "Sin preceptor"}</Chip>
                          </span>
                        </summary>
                        <div className="grid gap-4 border-t border-line p-3 md:grid-cols-[1fr_auto]">
                          <FormAccion accion={editarCurso.bind(null, c.id)} reiniciar={false} className="grid gap-2 sm:grid-cols-2">
                            <label className="campo"><span>Nombre</span><input name="nombre" defaultValue={c.nombre} className="input" /></label>
                            <label className="campo"><span>División</span><input name="division" defaultValue={c.division} className="input" /></label>
                            <label className="campo"><span>Turno</span><select name="turno" defaultValue={c.turno} className="input"><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select></label>
                            <label className="campo"><span>Preceptor/a</span>
                              <select name="preceptor" defaultValue={c.preceptorId ?? ""} className="input"><option value="">Sin asignar</option>{precs.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select>
                            </label>
                            <div className="flex flex-wrap gap-2 sm:col-span-2">
                              <Enviar className="btn-sec">Guardar</Enviar>
                              <Link href={`/materias?curso=${c.id}`} className="btn-sec">Materias</Link>
                              <Link href={`/usuarios?tab=alumnos&curso=${c.id}`} className="btn-sec">Alumnos</Link>
                            </div>
                          </FormAccion>
                          <FormAccion accion={eliminarCurso.bind(null, c.id)} reiniciar={false} className="self-end">
                            <Enviar className="btn-peligro btn-chico" pendiente="Borrando…">Borrar curso</Enviar>
                          </FormAccion>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Seccion>
          ))}
        </div>

        <Seccion titulo="Crear cursos" className="self-start">
          <FormAccion accion={crearCursos} className="grid gap-3">
            <label className="campo"><span>Nivel</span>
              <select id="cu-nivel" name="nivel" defaultValue="secundaria" className="input">{NIVELES.map((n) => <option key={n.id} value={n.id}>{n.texto}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo"><span>Desde año / sala</span><input id="cu-desde" name="desde" type="number" min={1} max={7} defaultValue={1} className="input" /></label>
              <label className="campo"><span>Hasta</span><input id="cu-hasta" name="hasta" type="number" min={1} max={7} defaultValue={6} className="input" /></label>
            </div>
            <label className="campo"><span>Divisiones (separadas por coma)</span><input id="cu-div" name="divisiones" defaultValue="A" className="input" placeholder="A, B" /></label>
            <label className="campo"><span>Turno</span><select id="cu-turno" name="turno" className="input"><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select></label>
            <label className="campo"><span>Preceptor/a (opcional)</span>
              <select id="cu-prec" name="preceptor" className="input"><option value="">Lo asigno después</option>{precs.map((p) => <option key={p.id} value={p.id}>{nombreCompleto(p)}</option>)}</select>
            </label>
            <details className="text-sm">
              <summary className="link cursor-pointer">Usar un nombre propio (por ejemplo «Taller I»)</summary>
              <label className="campo mt-2"><span>Nombre del curso</span><input id="cu-nombre" name="nombre" className="input" placeholder="Solo para crear un curso" /></label>
            </details>
            <p className="text-xs text-muted">Ejemplo: Secundaria, de 1 a 6, divisiones «A, B» crea 1° A, 1° B, 2° A… hasta 6° B. Inicial usa la edad de la sala (2 a 5).</p>
            <Enviar>Crear</Enviar>
          </FormAccion>
        </Seccion>
      </div>
    </>
  );
}
