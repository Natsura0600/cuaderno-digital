/**
 * Carga datos de ejemplo (ficticios). BORRA lo que haya en la base.
 * Uso: npm run db:seed
 * Con Upstash: definí KV_REST_API_URL y KV_REST_API_TOKEN (o `vercel env pull` antes).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { cargarDemo } = await import("../src/lib/demo");
  const r = await cargarDemo((m) => console.log(m));
  console.log(`Listo: ${r.alumnos} alumnos, ${r.materias} materias, ${r.asistencias} registros de asistencia.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
