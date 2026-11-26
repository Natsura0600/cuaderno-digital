import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { baseConfigurada } from "@/db";

export default async function Raiz() {
  if (!baseConfigurada) redirect("/ingresar");
  redirect((await usuarioActual()) ? "/inicio" : "/ingresar");
}
