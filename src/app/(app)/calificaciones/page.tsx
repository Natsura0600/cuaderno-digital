import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe, materiasDe, puedeVerAlumno } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { boletin, promediosDeMateria } from "@/lib/consultas";
import { fmtNota, riesgoAcademico } from "@/lib/notas";
import { Boletin, celdaNota } from "@/components/Boletin";
import { Chip, Encabezado, Pestanas, Seccion, TablaScroll, Vacio } from "@/components/ui";

export const metadata = { title: "Calificaciones" };

export default async function Calificaciones({ searchParams }: PageProps<"/calificaciones">) {
  const u = await requerir();
  const sp = await searchParams;

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    if (!hijos.length) return <Vacio titulo="No hay alumnos vinculados a tu cuenta" />;
    const h = hijos.find((x) => x.id === Number(sp.hijo)) ?? hijos[0];
    return (
      <>
        <Encabezado titulo="Calificaciones" bajada={`${h.nombre} ${h.apellido} · ${h.curso}`} acciones={<Link href="/reuniones" className="btn-sec">Pedir reunión con un docente</Link>} />
        {hijos.length > 1 && <Pestanas activo={h.id} items={hijos.map((x) => ({ href: `/calificaciones?hijo=${x.id}`, texto: x.nombre, clave: x.id }))} />}
        <Boletin materias={await boletin(h.id)} />
      </>
    );
  }

  if (sp.alumno && (await puedeVerAlumno(u, Number(sp.alumno)))) {
    const a = await db.alumnos.uno(Number(sp.alumno));
    if (a)
      return (
        <>
          <Encabezado titulo={`${a.nombre} ${a.apellido}`} bajada="Boletín del año" volver={{ href: `/calificaciones?curso=${a.cursoId}`, texto: "Volver al curso" }} />
          <Boletin materias={await boletin(a.id)} />
        </>
      );
  }

  if (u.rol === "profesor") {
    const mats = await materiasDe(u);
    const datos = await Promise.all(
      mats.map(async (m) => {
        const als = await alumnosDeCursos([m.cursoId]);
        const ps = await promediosDeMateria(m.id, als.map((a) => a.id));
        const riesgo = [...ps.values()].filter((p) => riesgoAcademico(p).nivel !== "ok").length;
        const actuales = [...ps.values()].map((p) => p[REGLAS.trimestreActual - 1]).filter((x): x is number => x !== null);
        return { m, total: als.length, riesgo, prom: actuales.length ? actuales.reduce((s, x) => s + x, 0) / actuales.length : null };
      }),
    );
    return (
      <>
        <Encabezado titulo="Calificaciones" bajada="Elegí una materia para cargar notas por criterio." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.map(({ m, total, riesgo, prom }) => (
            <Link key={m.id} href={`/calificaciones/${m.id}`} className="card p-5 transition hover:border-brand">
              <p className="eyebrow">{m.curso}</p>
              <p className="mt-1 font-display text-xl font-bold">{m.nombre}</p>
              <p className="mt-3 flex flex-wrap gap-2 text-sm">
                <Chip>{total} alumnos</Chip>
                <Chip tono={prom !== null && prom < REGLAS.notaAprobacion ? "peligro" : "marca"}>Promedio {fmtNota(prom && Math.round(prom * 10) / 10)}</Chip>
                {riesgo > 0 && <Chip tono="aviso">{riesgo} en riesgo</Chip>}
              </p>
            </Link>
          ))}
        </div>
      </>
    );
  }

  // Preceptoría y directivos: planilla por curso
  const cursos = await cursosDe(u);
  if (!cursos.length) return <Vacio titulo="No tenés cursos a cargo" />;
  const c = cursos.find((x) => x.id === Number(sp.curso)) ?? cursos[0];
  const t = [1, 2, 3].includes(Number(sp.t)) ? Number(sp.t) : REGLAS.trimestreActual;
  const als = await alumnosDeCursos([c.id]);
  const mats = (await materiasDe(u)).filter((m) => m.cursoId === c.id);
  const proms = await Promise.all(mats.map((m) => promediosDeMateria(m.id, als.map((a) => a.id))));
  return (
    <>
      <Encabezado titulo="Calificaciones" bajada={`Promedios del ${t}° trimestre · ${c.nombre}`} />
      <Pestanas activo={c.id} items={cursos.map((x) => ({ href: `/calificaciones?curso=${x.id}&t=${t}`, texto: x.nombre, clave: x.id }))} />
      <Pestanas activo={t} items={[1, 2, 3].map((n) => ({ href: `/calificaciones?curso=${c.id}&t=${n}`, texto: `${n}° trimestre`, clave: n }))} />
      <Seccion>
        <TablaScroll>
          <table className="tabla tabular">
            <thead>
              <tr>
                <th>Alumno</th>
                {mats.map((m) => <th key={m.id} className="!text-center" title={m.nombre}>{m.nombre.length > 12 ? m.nombre.split(" ").map((w) => w[0]).join("") : m.nombre}</th>)}
                <th className="!text-center">Bajo {REGLAS.notaAprobacion}</th>
              </tr>
            </thead>
            <tbody>
              {als.map((a) => {
                const fila = proms.map((p) => p.get(a.id)?.[t - 1] ?? null);
                const bajas = fila.filter((x) => x !== null && x < REGLAS.notaAprobacion).length;
                return (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap"><Link className="font-medium hover:underline" href={`/calificaciones?alumno=${a.id}`}>{a.apellido}, {a.nombre}</Link></td>
                    {fila.map((x, i) => <td key={i} className={`!text-center ${celdaNota(x)}`}>{fmtNota(x)}</td>)}
                    <td className="!text-center">{bajas ? <Chip tono={bajas >= 3 ? "peligro" : "aviso"}>{bajas}</Chip> : <span className="text-muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TablaScroll>
      </Seccion>
    </>
  );
}
