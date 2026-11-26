import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db, type Rol } from "@/db";

const COOKIE = "cuaderno_sesion";
const DURACION = 60 * 60 * 24 * 30; // 30 días

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function crearSesion(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION}s`)
    .sign(clave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

export type Usuario = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  cargo: string | null;
};

export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    const u = await db.usuarios.uno(Number(payload.uid));
    if (!u || !u.activo) return null;
    return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol, cargo: u.cargo };
  } catch {
    return null;
  }
});

/** Exige sesión y, opcionalmente, uno de los roles indicados. */
export async function requerir(...roles: Rol[]): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect("/ingresar");
  if (roles.length && !roles.includes(u.rol)) redirect("/inicio?sin-permiso=1");
  return u;
}

export const esPersonal = (u: Usuario) => u.rol !== "padre";
