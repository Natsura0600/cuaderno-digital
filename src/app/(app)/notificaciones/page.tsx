import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { fFechaHora } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import { Enviar } from "@/components/formularios";

export const metadata = { title: "Avisos" };

async function marcarTodas() {
  "use server";
  const u = await requerir();
  const todas = await db.avisos.todos(u.id);
  const sin = Object.entries(todas).filter(([, a]) => !a.leida);
  if (sin.length) await db.avisos.guardar(u.id, Object.fromEntries(sin.map(([k, a]) => [k, { ...a, leida: true }])));
  // Se guardan solo los últimos 150 avisos
  const viejos = Object.entries(todas).sort((a, b) => b[1].creado.localeCompare(a[1].creado)).slice(150).map(([k]) => k);
  if (viejos.length) await db.avisos.borrar(u.id, viejos);
  revalidatePath("/", "layout");
}

export default async function Notificaciones() {
  const u = await requerir();
  const avisos = (await db.avisos.lista(u.id)).sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 80);
  const sin = avisos.filter((a) => !a.leida).length;
  return (
    <>
      <Encabezado titulo="Avisos" bajada={sin ? `${sin} sin leer` : "Estás al día."} acciones={sin ? <form action={marcarTodas}><Enviar className="btn-sec">Marcar todo como leído</Enviar></form> : undefined} />
      {avisos.length === 0 ? <Vacio titulo="No tenés avisos" /> : (
        <ul className="card divide-y divide-line">
          {avisos.map((a) => {
            const contenido = (
              <div className="flex items-start gap-3 p-4">
                <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${a.leida ? "bg-transparent" : "bg-gold"}`} />
                <div className="min-w-0 flex-1">
                  <p className={a.leida ? "" : "font-semibold"}>{a.titulo}</p>
                  {a.cuerpo && <p className="text-sm text-muted">{a.cuerpo}</p>}
                </div>
                <span className="tabular shrink-0 text-xs text-muted">{fFechaHora(new Date(a.creado))}</span>
              </div>
            );
            return <li key={a.id}>{a.link ? <Link href={a.link} className="block hover:bg-surface-2">{contenido}</Link> : contenido}</li>;
          })}
        </ul>
      )}
    </>
  );
}
