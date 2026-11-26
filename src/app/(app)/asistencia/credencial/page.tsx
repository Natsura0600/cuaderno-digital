import QRCode from "qrcode";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, puedeVerAlumno, todosLosCursos } from "@/lib/alcance";
import { COLEGIO, SEDE } from "@/lib/config";
import { Encabezado, Pestanas, Vacio } from "@/components/ui";
import { Isotipo } from "@/components/Isotipo";

export const metadata = { title: "Credencial" };

export default async function Credencial({ searchParams }: PageProps<"/asistencia/credencial">) {
  const u = await requerir();
  const sp = await searchParams;
  const hijos = u.rol === "padre" ? await hijosDe(u.id) : [];
  const id = Number(sp.hijo) || hijos[0]?.id;
  const a = id && (await puedeVerAlumno(u, id)) ? await db.alumnos.uno(id) : null;
  if (!a) return <Vacio titulo="No encontramos la credencial" />;
  const curso = (await todosLosCursos()).find((c) => c.id === a.cursoId);
  const svg = await QRCode.toString(a.codigoQr, { type: "svg", margin: 1, color: { dark: "#18241e", light: "#ffffff" } });
  return (
    <>
      <Encabezado titulo="Credencial digital" bajada="Mostrala en la entrada para registrar el ingreso. También podés imprimirla o guardar una captura." />
      {hijos.length > 1 && <Pestanas activo={a.id} items={hijos.map((h) => ({ href: `/asistencia/credencial?hijo=${h.id}`, texto: h.nombre, clave: h.id }))} />}
      <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <div className="flex items-center gap-3 bg-brand px-5 py-4 text-brand-ink">
          <span className="grid size-10 place-items-center rounded-xl bg-white"><Isotipo size={26} /></span>
          <div className="leading-tight">
            <p className="font-display font-bold">{COLEGIO}</p>
            <p className="text-xs opacity-80">{SEDE}</p>
          </div>
        </div>
        <div className="p-6 text-center">
          <div className="mx-auto w-56 rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-4 font-display text-2xl font-bold">{a.nombre} {a.apellido}</p>
          <p className="text-muted">{curso?.nombre} · DNI {Number(a.dni).toLocaleString("es-AR")}</p>
          <p className="tabular mt-2 text-xs tracking-widest text-muted">{a.codigoQr}</p>
        </div>
      </div>
    </>
  );
}
