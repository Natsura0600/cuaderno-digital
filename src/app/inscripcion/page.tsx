import Link from "next/link";
import { COLEGIO } from "@/lib/config";
import { DOCUMENTOS } from "@/lib/matricula";
import { FormInscripcion } from "./FormInscripcion";

export const metadata = { title: "Solicitud de matrícula" };

export default function Inscripcion() {
  return (
    <>
      <h1 className="text-3xl font-bold">Solicitud de matrícula</h1>
      <p className="mt-2 max-w-prose text-muted">
        Completá el formulario para iniciar la inscripción en {COLEGIO}. Al enviarlo vas a recibir un código para seguir el estado de la solicitud.{" "}
        <Link href="/inscripcion/estado" className="link">¿Ya la enviaste? Consultá el estado</Link>
      </p>
      <div className="mt-6"><FormInscripcion documentos={DOCUMENTOS} /></div>
    </>
  );
}
