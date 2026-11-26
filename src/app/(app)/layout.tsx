import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { COLEGIO, SEDE } from "@/lib/config";
import { Shell } from "@/components/Shell";
import { salir } from "../acciones-sesion";
import { recordatoriosDeCuotas } from "@/lib/recordatorios";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const u = await requerir();
  if (u.rol === "padre") await recordatoriosDeCuotas(u.id);
  const n = (await db.avisos.lista(u.id)).filter((a) => !a.leida).length;
  return (
    <Shell rol={u.rol} nombre={`${u.nombre} ${u.apellido}`} cargo={u.cargo} colegio={COLEGIO} sede={SEDE} sinLeer={n} salir={salir} debeCambiarClave={u.debeCambiarClave}>
      {children}
    </Shell>
  );
}
