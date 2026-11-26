"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cerrarSesion, crearSesion } from "@/lib/auth";

export async function ingresar(_: { error: string } | null, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const clave = String(fd.get("clave") ?? "");
  if (!email || !clave) return { error: "Completá tu e-mail y tu contraseña." };
  const id = await db.idPorEmail(email);
  const u = id ? await db.usuarios.uno(id) : null;
  if (!u || !u.activo || !(await bcrypt.compare(clave, u.passwordHash)))
    return { error: "El e-mail o la contraseña no coinciden. Si no recordás tu clave, pedila en secretaría." };
  await crearSesion(u.id);
  redirect("/inicio");
}

export async function salir() {
  await cerrarSesion();
  redirect("/ingresar");
}
