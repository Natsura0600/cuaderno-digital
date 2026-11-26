import { notFound } from "next/navigation";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe, nombreCompleto, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { comunicadosParaPadre } from "@/lib/consultas";
import { destinatarios } from "@/lib/destinatarios";
import { fFechaHora, fFechaHoraMin } from "@/lib/fechas";
import { Aviso, Chip, Encabezado, Seccion, TablaScroll } from "@/components/ui";
import { Enviar } from "@/components/formularios";
import { firmar, recordar } from "../acciones";

export const metadata = { title: "Comunicado" };

export default async function Detalle({ params, searchParams }: PageProps<"/comunicados/[id]">) {
  const u = await requerir();
  const id = Number((await params).id);
  const sp = await searchParams;
  const us = await todosLosUsuarios();

  if (u.rol === "padre") {
    const c = (await comunicadosParaPadre(u.id)).find((x) => x.id === id);
    if (!c) notFound();
    let lectura = c.lectura;
    if (!lectura) {
      lectura = { padreId: u.id, leido: new Date().toISOString(), firmado: null, respuesta: null };
      await db.lecturas.guardar(id, { [u.id]: lectura });
    }
    return (
      <>
        <Encabezado titulo={c.titulo} bajada={`${c.autor}${c.autorCargo ? ` · ${c.autorCargo}` : ""} · ${c.curso ?? "Todo el colegio"}`} volver={{ href: "/comunicados", texto: "Comunicados" }} />
        <Seccion>
          <p className="tabular mb-4 text-sm text-muted">{fFechaHora(new Date(c.creado))}</p>
          <div className="max-w-prose whitespace-pre-line leading-relaxed">{c.cuerpo}</div>
          {c.tipo !== "informativo" && (
            <div className="mt-6 border-t border-line pt-5">
              {lectura.firmado ? (
                <Aviso tono="ok">
                  {c.tipo === "autorizacion" ? (lectura.respuesta === "autorizo" ? "Autorizaste" : "Respondiste que no autorizás") : "Firmaste la notificación"} el {fFechaHoraMin(new Date(lectura.firmado))}.
                </Aviso>
              ) : c.tipo === "firma" ? (
                <form action={firmar.bind(null, id, null)}><Enviar pendiente="Firmando…">Firmar: me notifico</Enviar></form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <form action={firmar.bind(null, id, "autorizo")}><Enviar pendiente="Enviando…">Autorizo</Enviar></form>
                  <form action={firmar.bind(null, id, "no_autorizo")}><Enviar className="btn-sec" pendiente="Enviando…">No autorizo</Enviar></form>
                </div>
              )}
            </div>
          )}
        </Seccion>
      </>
    );
  }

  const c = await db.comunicados.uno(id);
  if (!c) notFound();
  const mis = await cursosDe(u);
  if (u.rol !== "directivo" && c.autorId !== u.id && c.destino !== "todos" && !mis.some((x) => x.id === c.cursoId)) notFound();
  const [dest, lect, cursos] = await Promise.all([destinatarios(c), db.lecturas.todos(id), todosLosCursos()]);
  const filas = [...dest].map(([padreId, hijos]) => ({ padre: us.find((x) => x.id === padreId), hijos, l: lect[padreId] ?? null }));
  const leidos = filas.filter((f) => f.l).length;
  const firmados = filas.filter((f) => f.l?.firmado).length;
  const noAut = filas.filter((f) => f.l?.respuesta === "no_autorizo").length;
  const puedeRecordar = c.autorId === u.id || u.rol === "directivo";

  return (
    <>
      <Encabezado titulo={c.titulo} bajada={`${nombreCompleto(us.find((x) => x.id === c.autorId))} · ${c.destino === "todos" ? "Todo el colegio" : c.destino === "nivel" ? `Nivel ${c.nivel}` : cursos.find((x) => x.id === c.cursoId)?.nombre}`} volver={{ href: "/comunicados", texto: "Comunicados" }} />
      {sp.enviado && <div className="mb-4"><Aviso tono="ok">Comunicado enviado a {String(sp.enviado)} familias.</Aviso></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1fr]">
        <Seccion titulo="Mensaje">
          <p className="tabular mb-3 text-sm text-muted">{fFechaHora(new Date(c.creado))}</p>
          <div className="whitespace-pre-line leading-relaxed">{c.cuerpo}</div>
        </Seccion>
        <Seccion
          titulo="Seguimiento"
          acciones={puedeRecordar && (leidos < dest.size || (c.tipo !== "informativo" && firmados < dest.size)) ? <form action={recordar.bind(null, id)}><Enviar className="btn-sec btn-chico" pendiente="Enviando…">Recordar a quienes faltan</Enviar></form> : undefined}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip tono="info">{leidos} de {dest.size} leyeron</Chip>
            {c.tipo !== "informativo" && <Chip tono={firmados === dest.size ? "ok" : "aviso"}>{firmados} firmaron</Chip>}
            {c.tipo === "autorizacion" && noAut > 0 && <Chip tono="peligro">{noAut} no autorizan</Chip>}
          </div>
          <TablaScroll>
            <table className="tabla">
              <thead><tr><th>Familia</th><th>Alumno/a</th><th>Estado</th></tr></thead>
              <tbody>
                {filas.sort((a, b) => Number(Boolean(a.l?.firmado ?? a.l)) - Number(Boolean(b.l?.firmado ?? b.l))).map((f, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{nombreCompleto(f.padre)}</td>
                    <td>{f.hijos.map((h) => h.nombre).join(", ")}</td>
                    <td>
                      {!f.l ? <Chip tono="neutro">Sin leer</Chip> : c.tipo === "informativo" ? <Chip tono="ok">Leído</Chip> : !f.l.firmado ? <Chip tono="aviso">Leído, sin firmar</Chip> : f.l.respuesta === "no_autorizo" ? <Chip tono="peligro">No autoriza</Chip> : <Chip tono="ok">{c.tipo === "autorizacion" ? "Autoriza" : "Firmado"}</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </Seccion>
      </div>
    </>
  );
}
