import { redirect } from "next/navigation";
import { baseConfigurada, db, usaUpstash } from "@/db";
import { APP, COLEGIO } from "@/lib/config";
import { Perlas } from "@/components/Shell";
import { FaltaBase } from "@/components/FaltaBase";
import { Enviar } from "@/components/formularios";
import { FormInstalar } from "./FormInstalar";
import { cargarEjemplo } from "./acciones";

export const metadata = { title: "Configuración inicial" };
export const dynamic = "force-dynamic";

export default async function Instalar() {
  if (!baseConfigurada) return <FaltaBase />;
  if ((await db.usuarios.todos()).length > 0) redirect("/ingresar");
  return (
    <main className="mx-auto grid min-h-dvh max-w-3xl content-center gap-6 py-10 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand"><Perlas size={28} /></span>
        <div>
          <h1 className="text-2xl font-bold">Bienvenidos a {APP}</h1>
          <p className="text-muted">{COLEGIO} · la base de datos ({usaUpstash ? "Upstash Redis" : "Redis local"}) está vacía.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Empezar con datos reales</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Creá la primera cuenta del equipo directivo. Después cargás cursos, materias, docentes, alumnos y familias desde «Comunidad».</p>
          <FormInstalar />
        </section>
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Probar con datos de ejemplo</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Carga un colegio ficticio con 4 cursos, 48 alumnos, docentes, familias y un año de asistencia y notas, con cuentas de prueba para cada rol. Más adelante podés borrar todo desde la base de datos y empezar de cero.</p>
          <form action={cargarEjemplo}><Enviar className="btn-sec" pendiente="Cargando… (puede tardar un minuto)">Cargar datos de ejemplo</Enviar></form>
        </section>
      </div>
    </main>
  );
}
