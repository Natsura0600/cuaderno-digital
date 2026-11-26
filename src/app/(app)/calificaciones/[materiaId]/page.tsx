import { notFound } from "next/navigation";
import { claveNota, db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, puedeEditarMateria, todosLosCursos } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { fmtNota, promedioTrimestre, riesgoAcademico } from "@/lib/notas";
import { Chip, Encabezado, Pestanas, Seccion, TablaScroll, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { celdaNota } from "@/components/Boletin";
import { agregarCriterio, guardarNotas, quitarCriterio } from "./acciones";

export const metadata = { title: "Cargar notas" };

export default async function CargaNotas({ params, searchParams }: PageProps<"/calificaciones/[materiaId]">) {
  const u = await requerir("profesor", "directivo");
  const materiaId = Number((await params).materiaId);
  const sp = await searchParams;
  const m = await db.materias.uno(materiaId);
  if (!m || !(await puedeEditarMateria(u, materiaId))) notFound();
  const t = [1, 2, 3].includes(Number(sp.t)) ? Number(sp.t) : REGLAS.trimestreActual;
  const curso = (await todosLosCursos()).find((c) => c.id === m.cursoId)!;
  const [crs, als] = await Promise.all([db.criterios.todos((c) => c.materiaId === materiaId), alumnosDeCursos([m.cursoId])]);
  const notas = await db.notas.deVarios(als.map((a) => a.id));
  const mapa = new Map(als.map((a) => [a.id, Object.fromEntries((notas.get(a.id) ?? []).map((n) => [claveNota(n.criterioId, n.trimestre), n]))]));

  return (
    <>
      <Encabezado titulo={`${m.nombre} · ${curso.nombre}`} bajada="Cargá la nota de cada criterio. El promedio se calcula solo y, si un alumno queda por debajo de la nota de aprobación, la familia recibe un aviso." volver={{ href: "/calificaciones", texto: "Mis materias" }} />
      <Pestanas activo={t} items={[1, 2, 3].map((n) => ({ href: `/calificaciones/${materiaId}?t=${n}`, texto: `${n}° trimestre`, clave: n }))} />
      {crs.length === 0 ? (
        <Vacio titulo="Primero definí los criterios de evaluación">Por ejemplo: Trabajos prácticos (peso 1), Evaluaciones (peso 2).</Vacio>
      ) : (
        <Seccion>
          <FormAccion accion={guardarNotas.bind(null, materiaId, t)} reiniciar={false}>
            <TablaScroll>
              <table className="tabla tabular">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    {crs.map((c) => <th key={c.id} className="!text-center !normal-case">{c.nombre}<span className="block font-normal">peso {c.peso}</span></th>)}
                    <th className="!text-center">Promedio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {als.map((a) => {
                    const ns = mapa.get(a.id)!;
                    const lista = crs.flatMap((c) => [1, 2, 3].map((tt) => ns[claveNota(c.id, tt)]).filter(Boolean).map((n) => ({ ...n!, peso: c.peso })));
                    const proms = [1, 2, 3].map((tt) => promedioTrimestre(lista, tt));
                    const r = riesgoAcademico(proms.slice(0, t));
                    return (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap font-medium">{a.apellido}, {a.nombre}</td>
                        {crs.map((c) => (
                          <td key={c.id} className="!text-center">
                            <input
                              id={`n-${a.id}-${c.id}`}
                              name={`n-${a.id}-${c.id}`}
                              defaultValue={ns[claveNota(c.id, t)]?.nota ?? ""}
                              inputMode="decimal"
                              aria-label={`${a.nombre} ${a.apellido}, ${c.nombre}`}
                              className="input tabular w-16 !px-2 !py-1.5 text-center"
                            />
                          </td>
                        ))}
                        <td className={`!text-center text-base ${celdaNota(proms[t - 1])}`}>{fmtNota(proms[t - 1])}</td>
                        <td>{r.nivel === "ok" ? <Chip tono="ok">Bien</Chip> : <Chip tono={r.nivel === "riesgo" ? "peligro" : "aviso"}>{r.motivo}</Chip>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TablaScroll>
            <div className="mt-4 flex justify-end"><Enviar>Guardar notas del {t}° trimestre</Enviar></div>
          </FormAccion>
        </Seccion>
      )}

      <Seccion titulo="Criterios de evaluación" className="mt-4">
        <ul className="mb-4 grid gap-2">
          {crs.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span>{c.nombre} <span className="text-muted">· peso {c.peso}</span></span>
              <form action={quitarCriterio.bind(null, materiaId, c.id)}>
                <Confirmar mensaje="¿Seguro? Se borran sus notas">Quitar</Confirmar>
              </form>
            </li>
          ))}
        </ul>
        <FormAccion accion={agregarCriterio.bind(null, materiaId)} className="flex flex-wrap items-end gap-2">
          <label className="campo flex-1">
            <span>Nuevo criterio</span>
            <input id="crit-nombre" name="nombre" className="input" placeholder="Ej. Exposición oral" />
          </label>
          <label className="campo w-24">
            <span>Peso</span>
            <select id="crit-peso" name="peso" className="input" defaultValue="1">
              {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <Enviar className="btn-sec">Agregar</Enviar>
        </FormAccion>
      </Seccion>
    </>
  );
}
