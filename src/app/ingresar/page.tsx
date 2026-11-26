import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { baseConfigurada, db } from "@/db";
import { APP, COLEGIO, SEDE } from "@/lib/config";
import { FormIngreso } from "./FormIngreso";
import { Isotipo } from "@/components/Isotipo";
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
      <section className="relative hidden overflow-hidden lg:block">
        <Image src="/colegio/fachada.webp" alt="Fachada del Colegio Montessori" fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">{COLEGIO} · {SEDE}</p>
          <h1 className="mt-3 max-w-lg font-display text-5xl font-bold leading-[1.05]">Todo el colegio, en un mismo cuaderno.</h1>
          <p className="mt-4 max-w-md text-lg text-white/85">Asistencia, notas, comunicados, calendario y administración para familias, docentes, preceptores y directivos.</p>
          <div className="mt-6 flex h-1.5 w-40 overflow-hidden rounded-full" aria-hidden>
            <span className="flex-1 bg-[#e5322c]" /><span className="flex-1 bg-[#47a94a]" /><span className="flex-1 bg-[#4a66a0]" /><span className="flex-1 bg-[#e6e331]" />
          </div>
        </div>
      </section>

      <section className="flex flex-col">
        <div className="relative h-40 overflow-hidden lg:hidden">
          <Image src="/colegio/sede-roja.webp" alt="Edificio del Colegio Montessori" fill priority sizes="(min-width: 1024px) 0px, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-1 flex-col justify-center py-10 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center gap-4">
              <Isotipo size={56} />
              <div>
                <p className="font-display text-xl font-bold leading-tight">{APP}</p>
                <p className="text-sm text-muted">{COLEGIO}</p>
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
        </div>
      </section>
    </main>
  );
}
