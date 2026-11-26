import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";

export default async function Raiz() {
  redirect((await usuarioActual()) ? "/inicio" : "/ingresar");
}
