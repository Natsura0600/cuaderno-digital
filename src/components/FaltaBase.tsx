import { APP, COLEGIO } from "@/lib/config";
import { Isotipo } from "./Isotipo";

/** Se muestra cuando la app corre en Vercel sin la base de Upstash conectada. */
export function FaltaBase() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-5 py-10 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">
      <span className="grid size-14 place-items-center rounded-2xl border border-line bg-white"><Isotipo size={34} /></span>
      <h1 className="text-2xl font-bold">Falta conectar la base de datos</h1>
      <p className="text-muted">{APP} de {COLEGIO} ya está publicado, pero todavía no tiene dónde guardar los datos. Para conectarla:</p>
      <ol className="card grid list-decimal gap-2 p-5 pl-10 text-sm">
        <li>En Vercel, abrí el proyecto de esta app y entrá a <strong>Storage</strong>.</li>
        <li>Elegí <strong>Create Database → Upstash for Redis</strong> (o conectá una base de Upstash que ya tengas). Región sugerida: São Paulo.</li>
        <li>Conectala al proyecto con los entornos Production y Preview.</li>
        <li>En <strong>Deployments</strong>, volvé a desplegar el último deployment (<em>Redeploy</em>).</li>
        <li>Recargá esta página: vas a poder crear la cuenta de dirección o cargar datos de ejemplo.</li>
      </ol>
    </main>
  );
}
