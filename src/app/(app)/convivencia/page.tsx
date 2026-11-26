import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { alumnosDeCursos, cursosDe, hijosDe, nombreCompleto, todosLosUsuarios } from "@/lib/alcance";
import { fCorta } from "@/lib/fechas";
import { CATEGORIAS_INCIDENTE, CATEGORIAS_RECONOCIMIENTO } from "@/lib/protocolos";
import { Chip, Encabezado, Pestanas, Seccion, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { registrar } from "./acciones";

export const metadata = { title: "Convivencia" };

const tonoGravedad = (g: string | null) => (g === "grave" ? "peligro" : g === "moderada" ? "aviso" : "neutro") as "peligro" | "aviso" | "neutro";
const ESTADO = { abierto: "Abierto", en_seguimiento: "En seguimiento", cerrado: "Cerrado" } as const;

export default async function ConvivenciaPage({ searchParams }: PageProps<"/convivencia">) {
  const u = await requerir();
  const sp = await searchParams;
  const us = await todosLosUsuarios();

  if (u.rol === "padre") {
    const hijos = await hijosDe(u.id);
    const ids = new Set(hijos.map((h) => h.id));
    const regs = (await db.convivencia.todos((r) => ids.has(r.alumnoId) && r.visibleFamilia)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return (
      <>
        <Encabezado titulo="Convivencia" bajada="Reconocimientos y registros de convivencia de tus hijos." />
        {regs.length === 0 ? <Vacio titulo="No hay registros" /> : (
          <ul className="grid gap-3">
            {regs.map((r) => (
              <li key={r.id} className={`card border-l-4 p-4 ${r.tipo === "reconocimiento" ? "border-l-ok" : "border-l-warn"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tono={r.tipo === "reconocimiento" ? "ok" : tonoGravedad(r.gravedad)}>{r.tipo === "reconocimiento" ? "Reconocimiento" : r.categoria}</Chip>
                  <span className="text-sm font-semibold">{hijos.find((h) => h.id === r.alumnoId)?.nombre}</span>
                  <span className="text-sm text-muted">· {fCorta(r.fecha)} · {nombreCompleto(us.find((x) => x.id === r.autorId))}</span>
                </div>
                {r.tipo === "reconocimiento" && <p className="mt-2 font-semibold">{r.categoria}</p>}
                <p className="mt-1 text-sm">{r.descripcion}</p>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const cursos = await cursosDe(u);
  const als = await alumnosDeCursos(cursos.map((c) => c.id));
  const ids = new Set(als.map((a) => a.id));
  const filtro = String(sp.ver ?? "abiertos");
  const regs = (await db.convivencia.todos((r) => ids.has(r.alumnoId)))
    .filter((r) => (filtro === "abiertos" ? r.tipo === "incidente" && r.estado !== "cerrado" : filtro === "reconocimientos" ? r.tipo === "reconocimiento" : true))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const preseleccion = Number(sp.alumno) || undefined;

  return (
    <>
      <Encabezado titulo="Bitácora de convivencia" bajada="Registrá incidentes y también reconocimientos. Los casos siguen el protocolo de actuación de cada categoría." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Pestanas activo={filtro} items={[{ clave: "abiertos", texto: "Casos abiertos", href: "/convivencia?ver=abiertos" }, { clave: "reconocimientos", texto: "Reconocimientos", href: "/convivencia?ver=reconocimientos" }, { clave: "todos", texto: "Todos", href: "/convivencia?ver=todos" }]} />
          {regs.length === 0 ? <Vacio titulo="No hay registros para mostrar" /> : (
            <ul className="grid gap-2">
              {regs.map((r) => {
                const a = als.find((x) => x.id === r.alumnoId)!;
                return (
                  <li key={r.id}>
                    <Link href={`/convivencia/${r.id}`} className="card flex flex-wrap items-start justify-between gap-3 p-4 transition hover:border-brand">
                      <div className="min-w-0">
                        <p className="font-semibold">{a.apellido}, {a.nombre} <span className="font-normal text-muted">· {cursos.find((c) => c.id === a.cursoId)?.nombre}</span></p>
                        <p className="text-sm">{r.categoria}</p>
                        <p className="line-clamp-1 text-sm text-muted">{r.descripcion}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.tipo === "reconocimiento" ? <Chip tono="ok">Reconocimiento</Chip> : <><Chip tono={tonoGravedad(r.gravedad)}>{r.gravedad}</Chip><Chip tono={r.estado === "cerrado" ? "neutro" : "info"}>{ESTADO[r.estado]}</Chip></>}
                        {!r.visibleFamilia && <Chip tono="aviso">Confidencial</Chip>}
                        <span className="tabular text-xs text-muted">{fCorta(r.fecha)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Seccion titulo="Nuevo registro" className="self-start">
          <FormAccion accion={registrar} className="grid gap-3">
            <label className="campo">
              <span>Alumno</span>
              <select id="c-alumno" name="alumno" className="input" defaultValue={preseleccion} required>
                {cursos.map((c) => (
                  <optgroup key={c.id} label={c.nombre}>
                    {als.filter((a) => a.cursoId === c.id).map((a) => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Categoría</span>
              <select id="c-categoria" name="categoria" className="input" required>
                <optgroup label="Reconocimientos">{CATEGORIAS_RECONOCIMIENTO.map((c) => <option key={c}>{c}</option>)}</optgroup>
                <optgroup label="Incidentes">{Object.keys(CATEGORIAS_INCIDENTE).map((c) => <option key={c}>{c}</option>)}</optgroup>
              </select>
            </label>
            <label className="campo">
              <span>Gravedad (solo incidentes)</span>
              <select id="c-gravedad" name="gravedad" className="input" defaultValue="">
                <option value="">Según el protocolo</option>
                <option value="leve">Leve</option>
                <option value="moderada">Moderada</option>
                <option value="grave">Grave (avisa a dirección)</option>
              </select>
            </label>
            <label className="campo"><span>Qué pasó</span><textarea id="c-desc" name="descripcion" rows={3} className="input" required /></label>
            <label className="flex items-center gap-2 text-sm"><input id="c-visible" type="checkbox" name="visibleFamilia" defaultChecked className="size-4 accent-[var(--brand)]" /> Avisar y mostrar a la familia</label>
            <Enviar>Registrar</Enviar>
          </FormAccion>
        </Seccion>
      </div>
    </>
  );
}
