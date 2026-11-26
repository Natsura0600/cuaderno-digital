import { requerir } from "@/lib/auth";
import { Encabezado } from "@/components/ui";
import { Escaner } from "./Escaner";

export const metadata = { title: "Ingreso con QR" };

export default async function IngresoQr() {
  await requerir("preceptor", "directivo");
  return (
    <>
      <Encabezado titulo="Ingreso con credencial QR" bajada="Cada lectura marca presente, o llegada tarde después de las 7:45, y avisa a la familia si corresponde." volver={{ href: "/asistencia", texto: "Asistencia" }} />
      <Escaner />
    </>
  );
}
