import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe } from "@/lib/alcance";
import { REGLAS } from "@/lib/config";
import { inicioCiclo } from "@/lib/ajustes";
import { resumenAsistencia } from "@/lib/consultas";
import { esHabil, fLarga, hoy, mesNombre } from "@/lib/fechas";
import { fmtNota } from "@/lib/notas";
import { Aviso, Chip, Dato, Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { TomaAsistencia } from "./TomaAsistencia";

export const metadata = { title: "Asistencia" };

const COLOR: Record<string, string> = { presente: "bg-ok", ausente: "bg-bad", tarde: "bg-warn", justificado: "bg-info" };

export default async function Asistencia({ searchParams }: PageProps<"/asistencia">) {
  const u = await requerir("padre", "preceptor", "directivo");
  const sp = await searchParams;
  return u.rol === "padre" ? <VistaFamilia padreId={u.id} hijo={Number(sp.hijo)} /> : <VistaPreceptoria u={u} curso={Number(sp.curso)} fecha={String(sp.fecha ?? hoy())} />;
}

async function VistaFamilia({ padreId, hijo }: { padreId: number; hijo: number }) {
  const hijos = await hijosDe(padreId);
  if (!hijos.length) return <Vacio titulo="No hay alumnos vinculados a tu cuenta" />;
  const h = hijos.find((x) => x.id === hijo) ?? hijos[0];
  const [res, todos] = await Promise.all([resumenAsistencia([h.id]), db.asistencia.lista(h.id)]);
  const regs = todos.filter((x) => x.fecha >= inicioCiclo());
  const r = res.get(h.id)!;
  const meses = new Map<string, typeof regs>();
  for (const x of regs.sort((a, b) => b.fecha.localeCompare(a.fecha))) meses.set(x.fecha.slice(0, 7), [...(meses.get(x.fecha.slice(0, 7)) ?? []), x]);
  const pct = r.faltas / REGLAS.limiteInasistencias;
  return (
    <>
      <Encabezado titulo="Asistencia" bajada={`${h.nombre} ${h.apellido} · ${h.curso}`} acciones={<Link href={`/asistencia/credencial?hijo=${h.id}`} className="btn-sec">Credencial QR</Link>} />
      {hijos.length > 1 && <Pestanas activo={h.id} items={hijos.map((x) => ({ href: `/asistencia?hijo=${x.id}`, texto: x.nombre, clave: x.id }))} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Inasistencias" valor={fmtNota(r.faltas)} detalle={`de ${REGLAS.limiteInasistencias} permitidas`} tono={pct >= 0.8 ? "peligro" : pct >= 0.5 ? "aviso" : "ok"} />
        <Dato etiqueta="Ausencias" valor={r.ausentes} />
        <Dato etiqueta="Llegadas tarde" valor={r.tardes} detalle={`cada una suma ${String(REGLAS.valorTarde).replace(".", ",")} falta`} />
        <Dato etiqueta="Justificadas" valor={r.justificadas} detalle="no suman faltas" />
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${fmtNota(r.faltas)} de ${REGLAS.limiteInasistencias} faltas`}>
        <div className={`h-full rounded-full ${pct >= 0.8 ? "bg-bad" : pct >= 0.5 ? "bg-warn" : "bg-ok"}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      {r.faltas >= REGLAS.avisoInasistencias && (
        <div className="mt-4"><Aviso tono="aviso">Superó las {REGLAS.avisoInasistencias} inasistencias. Comunicate con preceptoría para la reincorporación.</Aviso></div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[...meses].map(([mes, rs]) => (
          <Seccion key={mes} titulo={mesNombre(mes)} acciones={<span className="text-sm text-muted">{rs.filter((x) => x.estado !== "presente").length} novedades</span>}>
            <div className="flex flex-wrap gap-1.5">
              {rs.slice().reverse().map((x) => (
                <span key={x.fecha} title={`${x.fecha.slice(8)}: ${x.estado}`} className={`tabular grid size-8 place-items-center rounded-lg text-xs font-bold text-white ${COLOR[x.estado]} ${x.estado === "presente" ? "opacity-35" : ""}`}>
                  {Number(x.fecha.slice(8))}
                </span>
              ))}
            </div>
            <ul className="mt-3 grid gap-1 text-sm">
              {rs.filter((x) => x.estado !== "presente").map((x) => (
                <li key={x.fecha} className="flex justify-between gap-2"><span>{fLarga(x.fecha)}</span><Chip tono={x.estado === "ausente" ? "peligro" : x.estado === "tarde" ? "aviso" : "info"}>{x.estado}</Chip></li>
              ))}
            </ul>
          </Seccion>
        ))}
      </div>
    </>
  );
}

async function VistaPreceptoria({ u, curso, fecha }: { u: Awaited<ReturnType<typeof requerir>>; curso: number; fecha: string }) {
  const cursos = await cursosDe(u);
  if (!cursos.length) return <Vacio titulo="No tenés cursos a cargo" />;
  const c = cursos.find((x) => x.id === curso) ?? cursos[0];
  const f = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoy() ? fecha : hoy();
  const als = await alumnosDeCursos([c.id]);
  const [marcas, res] = await Promise.all([Promise.all(als.map((a) => db.asistencia.campo(a.id, f))), resumenAsistencia(als.map((a) => a.id))]);
  return (
    <>
      <Encabezado
        titulo="Asistencia"
        bajada={<span>{fLarga(f)} · {c.nombre}</span>}
        acciones={<Link href="/asistencia/qr" className="btn-sec">Escanear credenciales QR</Link>}
      />
      <Pestanas activo={c.id} items={cursos.map((x) => ({ href: `/asistencia?curso=${x.id}&fecha=${f}`, texto: x.nombre, clave: x.id }))} />
      <form className="mb-5 flex flex-wrap items-end gap-2" action="/asistencia">
        <input type="hidden" name="curso" value={c.id} />
        <label className="campo">
          <span>Fecha</span>
          <input id="fecha" type="date" name="fecha" defaultValue={f} max={hoy()} className="input" />
        </label>
        <button className="btn-sec">Ver</button>
      </form>
      {!esHabil(f) ? (
        <Vacio titulo="Ese día no hay clases" />
      ) : (
        <TomaAsistencia
          key={`${c.id}-${f}`}
          cursoId={c.id}
          fecha={f}
          filas={als.map((a, i) => ({
            id: a.id,
            nombre: `${a.apellido}, ${a.nombre}`,
            estado: marcas[i]?.estado ?? null,
            metodo: marcas[i]?.metodo ?? null,
            faltas: res.get(a.id)!.faltas,
            limite: REGLAS.limiteInasistencias,
            aviso: REGLAS.avisoInasistencias,
          }))}
        />
      )}
    </>
  );
}
