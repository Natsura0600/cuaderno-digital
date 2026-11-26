import { db } from "@/db";
import { usuarioActual } from "@/lib/auth";
import { leerArchivo } from "@/lib/archivos";
import { hijosDe, todosLosCursos } from "@/lib/alcance";

/** Sirve archivos privados solo a quien tiene permiso de verlos. */
export async function GET(_: Request, ctx: RouteContext<"/archivos/[...ruta]">) {
  const u = await usuarioActual();
  if (!u) return new Response("Iniciá sesión para ver este archivo.", { status: 401 });
  const ruta = (await ctx.params).ruta.join("/");
  let permitido = false;
  if (ruta.startsWith("recursos/")) {
    const r = (await db.recursos.todos((x) => x.archivo === ruta))[0];
    if (r) {
      if (u.rol !== "padre") permitido = true;
      else if (!r.soloDocentes) {
        const cs = await todosLosCursos();
        permitido = (await hijosDe(u.id)).some((h) => cs.find((c) => c.id === h.cursoId)?.anio === r.anio);
      }
    }
  } else if (ruta.startsWith("matricula/")) {
    const s = (await db.solicitudes.todos((x) => x.documentos.some((d) => d.archivo === ruta)))[0];
    permitido = Boolean(s) && (u.rol === "directivo" || (u.rol === "padre" && s.padreId === u.id));
  }
  if (!permitido) return new Response("No tenés permiso para ver este archivo.", { status: 403 });
  const f = await leerArchivo(ruta);
  if (!f) return new Response("Archivo no encontrado.", { status: 404 });
  return new Response(f.body as BodyInit, { headers: { "content-type": f.tipo, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
}
