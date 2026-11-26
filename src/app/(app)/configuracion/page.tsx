import { requerir } from "@/lib/auth";
import { todosLosAlumnos, todosLosCursos } from "@/lib/alcance";
import { MODULOS, REGLAS } from "@/lib/config";
import { Aviso, Encabezado, Seccion } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { cerrarCiclo, guardarModulos, guardarReglas } from "./acciones";

export const metadata = { title: "Configuración" };

export default async function Configuracion() {
  await requerir("directivo");
  const [cursos, alumnos] = await Promise.all([todosLosCursos(), todosLosAlumnos()]);
  const R = REGLAS;
  return (
    <>
      <Encabezado titulo="Configuración" bajada="Reglas del colegio que usa toda la app: ciclo lectivo, trimestre, aprobación, asistencia y horario escolar." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Ciclo lectivo y evaluación">
          <FormAccion accion={guardarReglas} reiniciar={false} className="grid gap-3 sm:grid-cols-2">
            <label className="campo"><span>Ciclo lectivo</span><input id="cicloLectivo" name="cicloLectivo" type="number" defaultValue={R.cicloLectivo} className="input" /></label>
            <label className="campo"><span>Trimestre en curso</span>
              <select id="trimestreActual" name="trimestreActual" defaultValue={R.trimestreActual} className="input">{[1, 2, 3].map((t) => <option key={t} value={t}>{t}° trimestre</option>)}</select>
            </label>
            <label className="campo"><span>Nota de aprobación (1 a 10)</span><input id="notaAprobacion" name="notaAprobacion" type="number" step={0.5} min={1} max={10} defaultValue={R.notaAprobacion} className="input" /></label>
            <label className="campo"><span>Máximo de evaluaciones por día y curso</span><input id="maxEvaluacionesPorDia" name="maxEvaluacionesPorDia" type="number" min={1} max={10} defaultValue={R.maxEvaluacionesPorDia} className="input" /></label>
            <label className="campo"><span>Tope anual de inasistencias</span><input id="limiteInasistencias" name="limiteInasistencias" type="number" min={1} defaultValue={R.limiteInasistencias} className="input" /></label>
            <label className="campo"><span>Primer aviso de inasistencias</span><input id="avisoInasistencias" name="avisoInasistencias" type="number" min={1} defaultValue={R.avisoInasistencias} className="input" /></label>
            <label className="campo"><span>Una llegada tarde suma</span>
              <select id="valorTarde" name="valorTarde" defaultValue={R.valorTarde} className="input"><option value={0.25}>¼ de falta</option><option value={0.5}>½ falta</option><option value={1}>1 falta</option></select>
            </label>
            <label className="campo"><span>Llegada tarde desde (ingreso con QR)</span><input id="horaTarde" name="horaTarde" type="time" defaultValue={R.horaTarde} className="input" /></label>
            <div className="sm:col-span-2"><Enviar>Guardar</Enviar></div>
          </FormAccion>
        </Seccion>

        <Seccion titulo="Horario escolar">
          <p className="mb-3 text-sm text-muted">Un módulo por línea, con hora de inicio y de fin. Se usan en horarios, reservas y reemplazos.</p>
          <FormAccion accion={guardarModulos} reiniciar={false} className="grid gap-3">
            <label className="campo">
              <span>Módulos del día</span>
              <textarea id="modulos" name="modulos" rows={Math.max(7, MODULOS.length + 1)} defaultValue={MODULOS.map((m) => `${m.desde}-${m.hasta}`).join("\n")} className="input tabular font-mono" />
            </label>
            <div><Enviar>Guardar horario escolar</Enviar></div>
          </FormAccion>
        </Seccion>

        <Seccion titulo={`Cerrar el ciclo ${R.cicloLectivo} y pasar de año`} className="lg:col-span-2">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid content-start gap-3 text-sm">
              <p>Hacelo una sola vez, al terminar el año. El sistema:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Guarda las notas del año en el historial y deja los boletines en blanco para el ciclo nuevo.</li>
                <li>Pasa a cada alumno al curso del año siguiente con la misma división (1° A → 2° A).</li>
                <li>Los de la última sala o el último grado pasan al primer año del nivel siguiente; los del último año de secundaria egresan.</li>
                <li>Reinicia las planificaciones; el programa de cada materia se conserva.</li>
                <li>Cambia el ciclo vigente a {R.cicloLectivo + 1} y el trimestre a 1°.</li>
              </ul>
              <Aviso tono="aviso">Antes, creá los cursos que falten para el año que viene (por ejemplo, si hoy hay 1° B pero no 2° B).</Aviso>
            </div>
            <FormAccion accion={cerrarCiclo} reiniciar={false} className="grid content-start gap-3">
              <fieldset className="campo">
                <span>Alumnos que repiten (no pasan de año)</span>
                <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-3">
                  {cursos.map((c) => (
                    <div key={c.id}>
                      <p className="eyebrow mt-1">{c.nombre}</p>
                      {alumnos.filter((a) => a.cursoId === c.id).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="repiten" value={a.id} className="size-4 accent-[var(--bad)]" /> {a.apellido}, {a.nombre}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </fieldset>
              <label className="campo"><span>Para confirmar, escribí CERRAR</span><input id="confirmacion" name="confirmacion" autoComplete="off" className="input" /></label>
              <div><Enviar className="btn-peligro" pendiente="Cerrando el ciclo…">Cerrar ciclo {R.cicloLectivo}</Enviar></div>
            </FormAccion>
          </div>
        </Seccion>
      </div>
    </>
  );
}
