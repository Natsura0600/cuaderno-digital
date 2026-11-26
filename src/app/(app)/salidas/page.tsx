import Link from "next/link";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { cursosDe, hijosDe, nombreCompleto, todosLosUsuarios } from "@/lib/alcance";
import { fLarga, hoy, pesos, sumarDias } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Enviar, FormAccion } from "@/components/formularios";
import { crearSalida } from "./acciones";

export const metadata = { title: "Salidas pedagógicas" };

export default async function Salidas() {
  const u = await requerir();
  const cursos = await cursosDe(u);
  const ids = new Set(cursos.map((c) => c.id));
  const [sals, us] = await Promise.all([db.salidas.todos((s) => ids.has(s.cursoId)), todosLosUsuarios()]);
  const hijos = u.rol === "padre" ? await hijosDe(u.id) : [];
  const auts = await Promise.all(sals.map((s) => db.autorizaciones.lista(s.id)));
  const prox = sals.map((s, i) => ({ s, a: auts[i] })).filter((x) => x.s.fecha >= hoy()).sort((a, b) => a.s.fecha.localeCompare(b.s.fecha));
  const pasadas = sals.map((s, i) => ({ s, a: auts[i] })).filter((x) => x.s.fecha < hoy()).sort((a, b) => b.s.fecha.localeCompare(a.s.fecha));
  const staff = us.filter((x) => x.rol !== "padre" && x.activo && x.id !== u.id);

  const tarjeta = ({ s, a }: (typeof prox)[number]) => {
    const curso = cursos.find((c) => c.id === s.cursoId)?.nombre;
    const autorizados = a.filter((x) => x.autorizado).length;
    const pendientesHijos = hijos.filter((h) => h.cursoId === s.cursoId && !a.find((x) => x.alumnoId === h.id)?.firmado);
    return (
      <li key={s.id}>
        <Link href={`/salidas/${s.id}`} className="card flex flex-col gap-2 p-4 transition hover:border-brand">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tono="info">{curso}</Chip>
            <span className="text-sm text-muted">{fLarga(s.fecha)} · {s.horaSalida}–{s.horaRegreso}</span>
          </div>
          <p className="font-display text-lg font-bold">{s.titulo}</p>
          <p className="text-sm text-muted">{s.destino} · {s.costo ? pesos(s.costo) : "Sin costo"} · Responsables: {s.responsables.map((r) => nombreCompleto(us.find((x) => x.id === r))).join(", ")}</p>
          <div className="flex flex-wrap gap-2">
            {u.rol === "padre" ? (
              pendientesHijos.length ? <Chip tono="aviso">Falta tu autorización</Chip> : <Chip tono="ok">Respondida</Chip>
            ) : (
              <>
                <Chip tono="ok">{autorizados}/{a.length} autorizados</Chip>
                <Chip tono={a.some((x) => !x.firmado) ? "aviso" : "neutro"}>{a.filter((x) => !x.firmado).length} sin responder</Chip>
                {s.costo > 0 && <Chip tono="oro">{a.filter((x) => x.pagado).length} pagaron</Chip>}
              </>
            )}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <>
      <Encabezado titulo="Salidas pedagógicas" bajada="Autorizaciones firmadas desde la app, pagos, lista de asistentes y responsables." />
      <div className={`grid gap-4 ${u.rol !== "padre" ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="min-w-0">
          <h2 className="mb-2 text-lg font-semibold">Próximas</h2>
          {prox.length === 0 ? <Vacio titulo="No hay salidas programadas" /> : <ul className="grid gap-3">{prox.map(tarjeta)}</ul>}
          {pasadas.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-lg font-semibold">Realizadas</h2>
              <ul className="grid gap-3 opacity-80">{pasadas.map(tarjeta)}</ul>
            </>
          )}
        </div>
        {u.rol !== "padre" && (
          <Seccion titulo="Organizar una salida" className="self-start">
            <FormAccion accion={crearSalida} className="grid gap-3">
              <label className="campo"><span>Lugar</span><input id="s-titulo" name="titulo" className="input" required placeholder="Ej. Museo de Ciencias Naturales" /></label>
              <label className="campo"><span>Dirección / localidad</span><input id="s-destino" name="destino" className="input" required /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Curso</span><select id="s-curso" name="curso" className="input">{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                <label className="campo"><span>Fecha</span><input id="s-fecha" name="fecha" type="date" min={sumarDias(hoy(), 1)} defaultValue={sumarDias(hoy(), 14)} className="input" /></label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="campo"><span>Sale</span><input id="s-hs" name="horaSalida" type="time" defaultValue="08:00" className="input" /></label>
                <label className="campo"><span>Vuelve</span><input id="s-hr" name="horaRegreso" type="time" defaultValue="12:30" className="input" /></label>
                <label className="campo"><span>Costo $</span><input id="s-costo" name="costo" type="number" min={0} step={100} defaultValue={0} className="input" /></label>
              </div>
              <label className="campo"><span>Responsables (además de vos)</span>
                <select id="s-resp" name="responsables" multiple className="input h-28">{staff.map((x) => <option key={x.id} value={x.id}>{nombreCompleto(x)} · {x.cargo}</option>)}</select>
              </label>
              <label className="campo"><span>Propuesta pedagógica</span><textarea id="s-desc" name="descripcion" rows={2} className="input" /></label>
              <Enviar>Crear y pedir autorizaciones</Enviar>
            </FormAccion>
          </Seccion>
        )}
      </div>
    </>
  );
}
