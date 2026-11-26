import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { hijosDe, nombreCompleto, todasLasMaterias, todosLosCursos, todosLosUsuarios } from "@/lib/alcance";
import { fCorta } from "@/lib/fechas";
import { Chip, Encabezado, Seccion, Vacio } from "@/components/ui";
import { Confirmar, Enviar, FormAccion } from "@/components/formularios";
import { borrarRecurso, subirRecurso } from "./acciones";

export const metadata = { title: "Banco de recursos" };

const TIPOS = { guia: "Guía", examen: "Examen", presentacion: "Presentación", otro: "Otro" } as const;

export default async function Recursos({ searchParams }: PageProps<"/recursos">) {
  const u = await requerir();
  const sp = await searchParams;
  const [todos, us, mats, cursos] = await Promise.all([db.recursos.todos(), todosLosUsuarios(), todasLasMaterias(), todosLosCursos()]);
  const anios = [...new Set(cursos.map((c) => c.anio))].sort();
  const materiasNombres = [...new Set(mats.map((m) => m.nombre))].sort();
  let visibles = todos;
  if (u.rol === "padre") {
    const misAnios = new Set((await hijosDe(u.id)).map((h) => cursos.find((c) => c.id === h.cursoId)?.anio));
    visibles = todos.filter((r) => !r.soloDocentes && misAnios.has(r.anio));
  }
  const q = String(sp.q ?? "").toLowerCase();
  const fAnio = Number(sp.anio) || null;
  const fMat = String(sp.materia ?? "");
  const fTipo = String(sp.tipo ?? "");
  const lista = visibles
    .filter((r) => (!fAnio || r.anio === fAnio) && (!fMat || r.materia === fMat) && (!fTipo || r.tipo === fTipo) && (!q || `${r.titulo} ${r.descripcion ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => a.anio - b.anio || a.materia.localeCompare(b.materia) || (a.unidad ?? 0) - (b.unidad ?? 0));
  const puedeSubir = u.rol !== "padre";

  return (
    <>
      <Encabezado titulo="Banco de recursos" bajada="Guías, exámenes modelo y presentaciones ordenados por año, materia y unidad." />
      <div className={`grid gap-4 ${puedeSubir ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <div className="min-w-0">
          <form action="/recursos" className="card mb-4 grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="campo sm:col-span-2 lg:col-span-1"><span>Buscar</span><input id="q" name="q" defaultValue={q} className="input" placeholder="Título o descripción" /></label>
            <label className="campo"><span>Año</span><select id="f-anio" name="anio" defaultValue={fAnio ?? ""} className="input"><option value="">Todos</option>{anios.map((a) => <option key={a} value={a}>{a}° año</option>)}</select></label>
            <label className="campo"><span>Materia</span><select id="f-materia" name="materia" defaultValue={fMat} className="input"><option value="">Todas</option>{materiasNombres.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="campo"><span>Tipo</span><select id="f-tipo" name="tipo" defaultValue={fTipo} className="input"><option value="">Todos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="sm:col-span-2 lg:col-span-4"><button className="btn-sec">Filtrar</button></div>
          </form>
          {lista.length === 0 ? <Vacio titulo="No hay recursos con esos filtros" /> : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {lista.map((r) => (
                <li key={r.id} className="card flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tono="marca">{r.anio}° año</Chip>
                    <Chip>{r.materia}{r.unidad ? ` · U${r.unidad}` : ""}</Chip>
                    <Chip tono={r.tipo === "examen" ? "peligro" : r.tipo === "guia" ? "oro" : "info"}>{TIPOS[r.tipo]}</Chip>
                    {r.soloDocentes && <Chip tono="aviso">Solo docentes</Chip>}
                  </div>
                  <p className="font-semibold">{r.titulo}</p>
                  {r.descripcion && <p className="text-sm text-muted">{r.descripcion}</p>}
                  <p className="mt-auto text-xs text-muted">{nombreCompleto(us.find((x) => x.id === r.autorId))} · {fCorta(r.creado.slice(0, 10))}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.archivo && <a className="btn-prim btn-chico" href={`/archivos/${r.archivo}`} target="_blank" rel="noopener">Abrir {r.archivoNombre?.split(".").pop()?.toUpperCase()}</a>}
                    {r.url && <a className="btn-sec btn-chico" href={r.url} target="_blank" rel="noopener noreferrer">Abrir enlace</a>}
                    {(r.autorId === u.id || u.rol === "directivo") && <form action={borrarRecurso.bind(null, r.id)}><Confirmar mensaje="¿Borrar?">Borrar</Confirmar></form>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {puedeSubir && (
          <Seccion titulo="Compartir un recurso" className="self-start">
            <FormAccion accion={subirRecurso} className="grid gap-3">
              <label className="campo"><span>Título</span><input id="r-titulo" name="titulo" className="input" required /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="campo"><span>Tipo</span><select id="r-tipo" name="tipo" className="input">{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="campo"><span>Año</span><select id="r-anio" name="anio" className="input">{anios.map((a) => <option key={a} value={a}>{a}°</option>)}</select></label>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2">
                <label className="campo"><span>Materia</span><select id="r-materia" name="materia" className="input">{materiasNombres.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label className="campo"><span>Unidad</span><input id="r-unidad" name="unidad" type="number" min={1} max={12} className="input" /></label>
              </div>
              <label className="campo"><span>Descripción (opcional)</span><textarea id="r-desc" name="descripcion" rows={2} className="input" /></label>
              <label className="campo"><span>Archivo (PDF, Word, PowerPoint o imagen, hasta 8 MB)</span><input id="r-archivo" name="archivo" type="file" className="input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt" /></label>
              <label className="campo"><span>…o un enlace</span><input id="r-url" name="url" type="url" placeholder="https://" className="input" /></label>
              <label className="flex items-center gap-2 text-sm"><input id="r-solo" type="checkbox" name="soloDocentes" className="size-4 accent-[var(--brand)]" /> Visible solo para docentes (por ejemplo, exámenes)</label>
              <Enviar pendiente="Subiendo…">Publicar</Enviar>
            </FormAccion>
          </Seccion>
        )}
      </div>
    </>
  );
}
