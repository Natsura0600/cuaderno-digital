import { requerir } from "@/lib/auth";
import { cursosDe, hijosDe, materiasDe } from "@/lib/alcance";
import { eventosEntre, tareasDeCurso } from "@/lib/consultas";
import { fLarga, hoy, sumarDias } from "@/lib/fechas";
import { Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { ChipEvento } from "@/components/eventos";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { borrarTarea, crearTarea } from "./acciones";

export const metadata = { title: "Agenda" };

export default async function Agenda({ searchParams }: PageProps<"/agenda">) {
  const u = await requerir("padre", "profesor", "directivo");
  const sp = await searchParams;
  const desde = hoy();
  const hasta = sumarDias(desde, 21);
  let cursoIds: number[];
  let sub = "";
  let pest: React.ReactNode = null;
  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    if (!hijos.length) return <Vacio titulo="No hay alumnos vinculados" />;
    const h = hijos.find((x) => x.id === Number(sp.hijo)) ?? hijos[0];
    cursoIds = [h.cursoId];
    sub = `${h.nombre} · ${h.curso}`;
    if (hijos.length > 1) pest = <Pestanas activo={h.id} items={hijos.map((x) => ({ href: `/agenda?hijo=${x.id}`, texto: x.nombre, clave: x.id }))} />;
  } else {
    const cs = await cursosDe(u);
    const c = cs.find((x) => x.id === Number(sp.curso));
    cursoIds = c ? [c.id] : cs.map((x) => x.id);
    sub = c ? c.nombre : "Todos tus cursos";
    pest = <Pestanas activo={c?.id ?? 0} items={[{ clave: 0, texto: "Todos", href: "/agenda" }, ...cs.map((x) => ({ clave: x.id, texto: x.nombre, href: `/agenda?curso=${x.id}` }))]} />;
  }
  const [tars, evs] = await Promise.all([tareasDeCurso(cursoIds, desde, hasta), eventosEntre(cursoIds, desde, hasta)]);
  const items = [
    ...tars.map((t) => ({ k: `t${t.id}`, fecha: t.fecha, tipo: t.tipo as string, titulo: t.titulo, sub: t.materia, desc: t.descripcion, borrar: u.rol !== "padre" && (t.autorId === u.id || u.rol === "directivo") ? t.id : null })),
    ...evs.map((e) => ({ k: `e${e.id}`, fecha: e.fecha, tipo: e.tipo as string, titulo: e.titulo, sub: e.curso ?? "Todo el colegio", desc: e.descripcion, borrar: null })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dias = [...new Set(items.map((i) => i.fecha))];
  const mats = u.rol === "padre" ? [] : await materiasDe(u);

  return (
    <>
      <Encabezado titulo={u.rol === "padre" ? "Agenda" : "Tareas y materiales"} bajada={`${sub} · próximas 3 semanas: tareas, evaluaciones y materiales para traer.`} />
      {pest}
      <div className={`grid gap-4 ${u.rol !== "padre" ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <div className="min-w-0">
          {dias.length === 0 ? <Vacio titulo="No hay nada agendado" /> : (
            <ol className="grid gap-4">
              {dias.map((d) => (
                <li key={d}>
                  <h2 className="mb-2 text-base font-semibold">{d === hoy() ? "Hoy" : d === sumarDias(hoy(), 1) ? "Mañana" : fLarga(d)}</h2>
                  <ul className="grid gap-2">
                    {items.filter((i) => i.fecha === d).map((i) => (
                      <li key={i.k} className="card flex flex-wrap items-start justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{i.titulo}</p>
                          <p className="text-sm text-muted">{i.sub}{i.desc ? ` · ${i.desc}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChipEvento tipo={i.tipo} />
                          {i.borrar && <form action={borrarTarea.bind(null, i.borrar)}><Confirmar mensaje="¿Borrar?">Borrar</Confirmar></form>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
        {u.rol !== "padre" && (
          <Seccion titulo="Publicar en la agenda" className="self-start">
            <FormAccion accion={crearTarea} className="grid gap-3">
              <label className="campo"><span>Materia</span><select id="t-materia" name="materia" className="input">{mats.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {m.curso}</option>)}</select></label>
              <label className="campo"><span>Tipo</span><select id="t-tipo" name="tipo" className="input"><option value="tarea">Tarea</option><option value="material">Material para traer</option></select></label>
              <label className="campo"><span>Consigna o material</span><input id="t-titulo" name="titulo" className="input" required /></label>
              <label className="campo"><span>Detalle (opcional)</span><textarea id="t-desc" name="descripcion" rows={2} className="input" /></label>
              <label className="campo"><span>Para el día</span><input id="t-fecha" name="fecha" type="date" min={hoy()} defaultValue={sumarDias(hoy(), 1)} className="input" /></label>
              <Enviar>Publicar y avisar a las familias</Enviar>
            </FormAccion>
          </Seccion>
        )}
      </div>
    </>
  );
}
