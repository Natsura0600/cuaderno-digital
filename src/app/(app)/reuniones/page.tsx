import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, nombreCompleto, todasLasMaterias, todosLosAlumnos, todosLosUsuarios } from "@/lib/alcance";
import { fFechaHora, fLarga, hoy, sumarDias } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { cancelar, publicarTurnos, reservar } from "./acciones";

export const metadata = { title: "Reuniones" };

export default async function Reuniones() {
  const u = await requerir();
  const ahora = new Date().toISOString();
  const [turnos, us, als, mats] = await Promise.all([db.turnos.todos((t) => !t.cancelado && t.inicio >= ahora), todosLosUsuarios(), todosLosAlumnos(), todasLasMaterias()]);
  turnos.sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    const cursosHijos = new Set(hijos.map((h) => h.cursoId));
    const mios = turnos.filter((t) => t.padreId === u.id);
    // Docentes de los cursos de mis hijos + preceptores + directivos
    const relevantes = new Set([
      ...mats.filter((m) => cursosHijos.has(m.cursoId)).map((m) => m.profesorId),
      ...us.filter((x) => x.rol === "directivo" || x.rol === "preceptor").map((x) => x.id),
    ]);
    const libres = turnos.filter((t) => !t.padreId && relevantes.has(t.docenteId));
    const porDocente = [...new Set(libres.map((t) => t.docenteId))];
    return (
      <>
        <Encabezado titulo="Reuniones" bajada="Elegí un horario libre del docente. Sin llamar a secretaría." />
        {mios.length > 0 && (
          <Seccion titulo="Tus reuniones" className="mb-4">
            <ul className="grid gap-2">
              {mios.map((t) => {
                const d = us.find((x) => x.id === t.docenteId);
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft p-3">
                    <span><strong >{fFechaHora(new Date(t.inicio))}</strong> · {nombreCompleto(d)} <span className="text-muted">({d?.cargo})</span> · {t.modalidad}</span>
                    <form action={cancelar.bind(null, t.id)}><Confirmar mensaje="¿Cancelar?">Cancelar</Confirmar></form>
                  </li>
                );
              })}
            </ul>
          </Seccion>
        )}
        {porDocente.length === 0 ? <Vacio titulo="No hay horarios publicados por ahora" /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {porDocente.map((id) => {
              const d = us.find((x) => x.id === id);
              return (
                <Seccion key={id} titulo={<span>{nombreCompleto(d)} <span className="block text-sm font-normal text-muted">{d?.cargo}</span></span>}>
                  <ul className="grid gap-2">
                    {libres.filter((t) => t.docenteId === id).slice(0, 6).map((t) => (
                      <li key={t.id}>
                        <details className="rounded-xl border border-line">
                          <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 text-sm font-medium">
                            <span>{fFechaHora(new Date(t.inicio))} · {t.minutos} min</span>
                            <Chip tono={t.modalidad === "virtual" ? "info" : "neutro"}>{t.modalidad}</Chip>
                          </summary>
                          <FormAccion accion={reservar.bind(null, t.id)} className="grid gap-2 border-t border-line p-3">
                            <label className="campo"><span>Alumno/a</span><select name="alumno" className="input">{hijos.map((h) => <option key={h.id} value={h.id}>{h.nombre} · {h.curso}</option>)}</select></label>
                            <label className="campo"><span>Motivo</span><input name="motivo" className="input" placeholder="Ej. consulta sobre Matemática" /></label>
                            <Enviar>Reservar este horario</Enviar>
                          </FormAccion>
                        </details>
                      </li>
                    ))}
                  </ul>
                </Seccion>
              );
            })}
          </div>
        )}
      </>
    );
  }

  const mios = turnos.filter((t) => t.docenteId === u.id);
  const dias = [...new Set(mios.map((t) => t.inicio.slice(0, 10)))];
  return (
    <>
      <Encabezado titulo="Reuniones con familias" bajada="Publicá horarios libres y las familias los reservan desde la app." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {mios.length === 0 ? <Vacio titulo="No publicaste horarios">Usá el formulario para ofrecer turnos.</Vacio> : (
            <div className="grid gap-4">
              {dias.map((d) => (
                <Seccion key={d} titulo={<span>{fLarga(d)}</span>}>
                  <ul className="grid gap-2">
                    {mios.filter((t) => t.inicio.startsWith(d)).map((t) => {
                      const a = als.find((x) => x.id === t.alumnoId);
                      return (
                        <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-sm ${t.padreId ? "bg-brand-soft" : "border border-dashed border-line"}`}>
                          <span>
                            <strong className="tabular">{fFechaHora(new Date(t.inicio)).split(", ").pop()}</strong> · {t.modalidad}
                            {t.padreId ? <> · <strong>{nombreCompleto(a)}</strong> ({nombreCompleto(us.find((x) => x.id === t.padreId))}) — {t.motivo}</> : <span className="text-muted"> · libre</span>}
                          </span>
                          <form action={cancelar.bind(null, t.id)}><Confirmar mensaje={t.padreId ? "¿Cancelar? Se avisa a la familia" : "¿Quitar?"}>{t.padreId ? "Cancelar" : "Quitar"}</Confirmar></form>
                        </li>
                      );
                    })}
                  </ul>
                </Seccion>
              ))}
            </div>
          )}
        </div>
        <Seccion titulo="Publicar horarios" className="self-start">
          <FormAccion accion={publicarTurnos} className="grid gap-3">
            <label className="campo"><span>Día</span><input id="tu-fecha" name="fecha" type="date" min={hoy()} defaultValue={sumarDias(hoy(), 1)} className="input" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo"><span>Desde</span><input id="tu-desde" name="desde" type="time" defaultValue="13:00" className="input" /></label>
              <label className="campo"><span>Duración</span><select id="tu-min" name="minutos" className="input" defaultValue="20">{[15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo"><span>Cantidad</span><input id="tu-cant" name="cantidad" type="number" min={1} max={12} defaultValue={3} className="input" /></label>
              <label className="campo"><span>Modalidad</span><select id="tu-mod" name="modalidad" className="input"><option value="presencial">Presencial</option><option value="virtual">Virtual</option></select></label>
            </div>
            <Enviar>Publicar horarios</Enviar>
          </FormAccion>
        </Seccion>
      </div>
    </>
  );
}
