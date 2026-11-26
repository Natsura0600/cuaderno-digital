import { db } from "@/db";
import { fFechaHora } from "@/lib/fechas";
import { ESTADO_SOL, ORDEN_ESTADOS } from "@/lib/matricula";
import { Aviso, Chip } from "@/components/ui";

export const metadata = { title: "Estado de la matrícula" };

export default async function Estado({ searchParams }: PageProps<"/inscripcion/estado">) {
  const sp = await searchParams;
  const codigo = String(sp.codigo ?? "").trim().toUpperCase();
  const dni = String(sp.dni ?? "").replace(/\D/g, "");
  const id = codigo ? await db.solicitudPorCodigo(codigo) : null;
  const s = id ? await db.solicitudes.uno(id) : null;
  const valida = s && s.alumnoDni === dni;
  const idx = valida ? ORDEN_ESTADOS.indexOf(s.estado) : -1;
  return (
    <>
      <h1 className="text-3xl font-bold">Estado de la solicitud</h1>
      {sp.nueva && valida && <div className="mt-4"><Aviso tono="ok">¡Solicitud enviada! Guardá tu código: <strong className="tabular">{s.codigo}</strong></Aviso></div>}
      <form className="card mt-6 grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_1fr_auto] sm:items-end" action="/inscripcion/estado">
        <label className="campo"><span>Código</span><input id="e-codigo" name="codigo" defaultValue={codigo} placeholder="M2027-115" className="input" required /></label>
        <label className="campo"><span>DNI del alumno</span><input id="e-dni" name="dni" defaultValue={dni} inputMode="numeric" className="input" required /></label>
        <button className="btn-prim">Consultar</button>
      </form>
      {codigo && !valida && <div className="mt-4"><Aviso tono="aviso">No encontramos una solicitud con ese código y DNI.</Aviso></div>}
      {valida && (
        <section className="card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-xl font-bold">{s.alumnoNombre} {s.alumnoApellido}</p>
            <Chip tono={ESTADO_SOL[s.estado].tono}>{ESTADO_SOL[s.estado].texto}</Chip>
          </div>
          <p className="text-sm text-muted">{s.anio}° año · ciclo lectivo {s.cicloLectivo} · enviada el {fFechaHora(new Date(s.creado))}</p>
          <p className="mt-4">{ESTADO_SOL[s.estado].ayuda}</p>
          {s.observaciones && <p className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn"><strong>Observaciones:</strong> {s.observaciones}</p>}
          {s.estado !== "rechazada" && (
            <ol className="mt-6 grid gap-2 sm:grid-cols-5">
              {ORDEN_ESTADOS.map((e, i) => (
                <li key={e} className={`rounded-xl px-3 py-2 text-xs font-semibold ${i <= idx ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted"}`}>{i + 1}. {ESTADO_SOL[e].texto}</li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-sm text-muted">Documentos recibidos: {s.documentos.length ? s.documentos.map((d) => d.nombre).join(", ") : "ninguno todavía"}.</p>
        </section>
      )}
    </>
  );
}
