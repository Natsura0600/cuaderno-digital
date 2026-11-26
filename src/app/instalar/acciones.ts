"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { crearSesion } from "@/lib/auth";
import { cargarDemo } from "@/lib/demo";

async function baseVacia() {
  return (await db.usuarios.todos()).length === 0;
}

export async function crearPrimerDirectivo(_: { error: string } | null, fd: FormData) {
  if (!(await baseVacia())) return { error: "La app ya está configurada. Ingresá con tu cuenta." };
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const email = v("email").toLowerCase();
  if (!v("nombre") || !v("apellido")) return { error: "Completá nombre y apellido." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Revisá el e-mail." };
  if (v("clave").length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  const u = await db.usuarios.insertar({
    nombre: v("nombre"), apellido: v("apellido"), email, passwordHash: await bcrypt.hash(v("clave"), 10), rol: "directivo",
    telefono: null, cargo: v("cargo") || "Dirección", activo: true, creado: new Date().toISOString(),
  });
  await db.indexarEmail(email, u.id);
  await crearSesion(u.id);
  redirect("/usuarios?tab=cursos");
}

export async function cargarEjemplo() {
  if (!(await baseVacia())) redirect("/ingresar");
  await cargarDemo();
  redirect("/ingresar");
}
