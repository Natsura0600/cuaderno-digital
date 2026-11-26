import Link from "next/link";
import { requerir } from "@/lib/auth";
import { cursosDe } from "@/lib/alcance";
import { calcularAlertas } from "@/lib/alertas";
import { REGLAS } from "@/lib/config";
import { Chip, Encabezado, Pestanas, Vacio } from "@/components/ui";
import { Enviar } from "@/components/formularios";
import { citarFamilia } from "./acciones";

export const metadata = { title: "Alertas tempranas" };

const TONO = { asistencia: "info", notas: "peligro", convivencia: "aviso" } as const;

export default async function Alertas({ searchParams }: PageProps<"/alertas">) {
  const u = await requerir("preceptor", "directivo");
  const sp = await searchParams;
  const cursos = await cursosDe(u);
  const filtro = Number(sp.curso) || null;
  const alertas = await calcularAlertas(filtro ? [filtro] : cursos.map((c) => c.id));
  return (
    <>
      <Encabezado
        titulo="Alertas tempranas"
        bajada={`Cruza inasistencias (tope ${REGLAS.limiteInasistencias}), notas debajo de ${REGLAS.notaAprobacion} o en caída, e incidentes recientes para detectar a tiempo a quien puede dejar la escuela.`}
      />
      <Pestanas activo={filtro ?? 0} items={[{ clave: 0, texto: "Todos", href: "/alertas" }, ...cursos.map((c) => ({ clave: c.id, texto: c.nombre, href: `/alertas?curso=${c.id}` }))]} />
      {alertas.length === 0 ? <Vacio titulo="No hay alumnos en alerta">Buenas noticias.</Vacio> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {alertas.map((a) => (
            <li key={a.alumnoId} className={`card border-l-4 p-4 ${a.nivel === "alta" ? "border-l-bad" : "border-l-warn"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{a.nombre}</p>
                  <p className="text-sm text-muted">{a.curso}</p>
                </div>
                <Chip tono={a.nivel === "alta" ? "peligro" : "aviso"}>Prioridad {a.nivel}</Chip>
              </div>
              <ul className="mt-3 grid gap-1.5">
                {a.motivos.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm"><Chip tono={TONO[m.tipo]}>{m.tipo}</Chip>{m.texto}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn-sec btn-chico" href={`/calificaciones?alumno=${a.alumnoId}`}>Boletín</Link>
                <Link className="btn-sec btn-chico" href={`/convivencia?alumno=${a.alumnoId}&ver=todos`}>Registrar intervención</Link>
                <form action={citarFamilia.bind(null, a.alumnoId)}><Enviar className="btn-prim btn-chico" pendiente="Enviando…">Citar a la familia</Enviar></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
