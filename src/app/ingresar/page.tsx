import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { baseConfigurada, db } from "@/db";
import { APP, COLEGIO, SEDE } from "@/lib/config";
import { FormIngreso } from "./FormIngreso";
import { Perlas } from "@/components/Shell";
import { FaltaBase } from "@/components/FaltaBase";

export const metadata = { title: "Ingresar" };

const DEMO = [
  { rol: "Directivo", email: "direccion@cuaderno.demo" },
  { rol: "Preceptor", email: "preceptoria@cuaderno.demo" },
  { rol: "Profesor", email: "profesora@cuaderno.demo" },
  { rol: "Familia", email: "familia@cuaderno.demo" },
];

export default async function Ingresar() {
  if (!baseConfigurada) return <FaltaBase />;
  if (await usuarioActual()) redirect("/inicio");
  // Las cuentas de prueba se muestran solo si están cargados los datos de ejemplo
  const demo = process.env.MOSTRAR_DEMO !== "0" && Boolean(await db.idPorEmail("direccion@cuaderno.demo"));
  const vacia = !demo && (await db.usuarios.todos()).length === 0;
  if (vacia) redirect("/instalar");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden bg-brand p-12 text-brand-ink lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10"><Perlas size={28} /></span>
          <span className="font-display text-xl font-bold">{APP}</span>
        </div>
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] opacity-80">{COLEGIO} · {SEDE}</p>
          <h1 className="mt-3 font-display text-5xl font-bold leading-[1.05]">Todo el colegio, en un mismo cuaderno.</h1>
          <p className="mt-4 text-lg opacity-85">Asistencia, notas, comunicados, calendario y administración para familias, docentes, preceptores y directivos.</p>
        </div>
        <svg className="absolute -bottom-16 -right-16 opacity-15" width="360" height="360" viewBox="0 0 100 100" aria-hidden>
          {Array.from({ length: 10 }).map((_, f) =>
            Array.from({ length: 10 }).map((_, c) => <circle key={`${f}-${c}`} cx={5 + c * 10} cy={5 + f * 10} r="4.2" fill="#f0b54a" />),
          )}
        </svg>
      </section>

      <section className="flex flex-col justify-center px-[max(16px,env(safe-area-inset-left))] py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-brand"><Perlas /></span>
            <div>
              <p className="font-display font-bold">{APP}</p>
              <p className="text-xs text-muted">{COLEGIO} · {SEDE}</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold">Ingresar</h2>
          <p className="mt-1 text-muted">Usá el e-mail que registraste en el colegio.</p>
          <FormIngreso />
          <p className="mt-6 text-sm text-muted">
            ¿Querés inscribir a tu hijo o hija?{" "}
            <Link href="/inscripcion" className="link">Iniciá la solicitud de matrícula</Link>
          </p>

          {demo && (
            <div className="mt-8 rounded-2xl border border-dashed border-line p-4">
              <p className="eyebrow">Cuentas de prueba</p>
              <p className="mt-1 text-sm text-muted">Contraseña para todas: <code className="font-semibold text-ink">montessori</code></p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {DEMO.map((d) => (
                  <li key={d.email} className="flex flex-wrap justify-between gap-x-3">
                    <span className="font-medium">{d.rol}</span>
                    <span className="select-all text-muted">{d.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
