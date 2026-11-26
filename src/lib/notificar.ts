import "server-only";
import { db } from "@/db";

type Aviso = { titulo: string; cuerpo?: string; link?: string; tipo?: string };

/**
 * Crea avisos dentro de la app. Acá se puede sumar el envío por e-mail,
 * WhatsApp Business o notificaciones push cuando el colegio contrate el servicio.
 */
export async function notificar(usuarioIds: number[], aviso: Aviso) {
  const ids = [...new Set(usuarioIds)];
  await Promise.all(
    ids.map(async (uid) => {
      const id = await db.siguienteId("avisos");
      await db.avisos.guardar(uid, {
        [id]: { id, titulo: aviso.titulo, cuerpo: aviso.cuerpo ?? null, link: aviso.link ?? null, tipo: aviso.tipo ?? "info", leida: false, creado: new Date().toISOString() },
      });
    }),
  );
}

export async function padresDe(alumnoIds: number[]) {
  const ids = new Set(alumnoIds);
  return db.familias.todos((f) => ids.has(f.alumnoId));
}

export async function notificarFamilias(alumnoId: number, aviso: Aviso) {
  const p = await padresDe([alumnoId]);
  await notificar(p.map((x) => x.padreId), aviso);
}
