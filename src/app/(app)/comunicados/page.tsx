import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe, nombreCompleto, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { comunicadosParaPadre } from "@/lib/consultas";
import { destinatarios } from "@/lib/destinatarios";
import { fFechaHora } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { publicar } from "./acciones";

export const metadata = { title: "Comunicados" };

const TIPO = { informativo: "Informativo", firma: "Requiere firma", autorizacion: "Autorización" } as const;

export default async function Comunicados() {
  const u = await requerir();
  if (u.rol === "padre") {
    const coms = await comunicadosParaPadre(u.id);
    return (
      <>
        <Encabezado titulo="Comunicados" bajada="El canal oficial del colegio. Lo que requiere firma queda registrado con fecha y hora." />
        {coms.length === 0 ? <Vacio titulo="No hay comunicados" /> : (
          <ul className="grid gap-2">
            {coms.map((c) => {
              const pend = c.tipo !== "informativo" && !c.lectura?.firmado;
              return (
                <li key={c.id}>
                  <Link href={`/comunicados/${c.id}`} className={`card flex flex-wrap items-start justify-between gap-3 p-4 transition hover:border-brand ${!c.lectura ? "border-l-4 border-l-info" : ""}`}>
                    <div className="min-w-0">
                      <p className={c.lectura ? "font-medium" : "font-bold"}>{c.titulo}</p>
                      <p className="text-sm text-muted">{c.autor}{c.autorCargo ? ` · ${c.autorCargo}` : ""} · {c.curso ?? "Todo el colegio"}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">{c.cuerpo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular text-xs text-muted">{fFechaHora(new Date(c.creado))}</span>
                      {!c.lectura ? <Chip tono="info">Nuevo</Chip> : pend ? <Chip tono="aviso">Falta firmar</Chip> : c.tipo !== "informativo" ? <Chip tono="ok">Firmado</Chip> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  const misCursos = await cursosDe(u);
  const [coms, us, cursos] = await Promise.all([db.comunicados.todos(), todosLosUsuarios(), todosLosCursos()]);
  const visibles = coms
    .filter((c) => u.rol === "directivo" || c.autorId === u.id || c.destino === "todos" || (c.cursoId !== null && misCursos.some((x) => x.id === c.cursoId)))
    .sort((a, b) => b.creado.localeCompare(a.creado));
  const stats = await Promise.all(visibles.map(async (c) => ({ dest: (await destinatarios(c)).size, lect: Object.values(await db.lecturas.todos(c.id)) })));

  return (
    <>
      <Encabezado titulo="Comunicados" bajada="Circulares, notas para firmar y autorizaciones, con confirmación de lectura." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="grid min-w-0 content-start gap-2">
          {visibles.map((c, i) => {
            const s = stats[i];
            const leidos = s.lect.length;
            const firmados = s.lect.filter((l) => l.firmado).length;
            return (
              <li key={c.id}>
                <Link href={`/comunicados/${c.id}`} className="card flex flex-wrap items-start justify-between gap-3 p-4 transition hover:border-brand">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.titulo}</p>
                    <p className="text-sm text-muted">{nombreCompleto(us.find((x) => x.id === c.autorId))} · {c.destino === "todos" ? "Todo el colegio" : c.destino === "nivel" ? `Nivel ${c.nivel}` : cursos.find((x) => x.id === c.cursoId)?.nombre} · <span>{fFechaHora(new Date(c.creado))}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tono={c.tipo === "informativo" ? "neutro" : "oro"}>{TIPO[c.tipo]}</Chip>
                    <Chip tono="info">{leidos}/{s.dest} leído</Chip>
                    {c.tipo !== "informativo" && <Chip tono={firmados === s.dest ? "ok" : "aviso"}>{firmados}/{s.dest} firmado</Chip>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <Seccion titulo="Nuevo comunicado" className="self-start">
          <FormAccion accion={publicar} className="grid gap-3">
            <label className="campo"><span>Título</span><input id="co-titulo" name="titulo" className="input" required /></label>
            <label className="campo"><span>Mensaje</span><textarea id="co-cuerpo" name="cuerpo" rows={6} className="input" required /></label>
            <label className="campo">
              <span>Para</span>
              <select id="co-destino" name="destino" className="input" defaultValue="curso">
                {u.rol === "directivo" && <option value="todos">Todas las familias del colegio</option>}
                {u.rol === "directivo" && <option value="nivel">Un nivel</option>}
                <option value="curso">Un curso</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo"><span>Curso</span><select id="co-curso" name="curso" className="input">{misCursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
              {u.rol === "directivo" && <label className="campo"><span>Nivel</span><select id="co-nivel" name="nivel" className="input"><option value="secundaria">Secundaria</option><option value="primaria">Primaria</option><option value="inicial">Inicial</option></select></label>}
            </div>
            <label className="campo">
              <span>Tipo</span>
              <select id="co-tipo" name="tipo" className="input">
                <option value="informativo">Informativo (confirma lectura)</option>
                <option value="firma">Requiere firma de notificación</option>
                <option value="autorizacion">Autorización (autorizo / no autorizo)</option>
              </select>
            </label>
            <Enviar pendiente="Enviando…">Enviar a las familias</Enviar>
          </FormAccion>
        </Seccion>
      </div>
    </>
  );
}
