import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db, kv, type Rol } from "@/db";
import { cargarAjustes } from "./ajustes";

const COOKIE = "cuaderno_sesion";
const DURACION = 60 * 60 * 24 * 30; // 30 días

let claveCache: Uint8Array | null = null;

/**
 * Clave para firmar sesiones: SESSION_SECRET si está definida; si no, se genera una
 * vez y se guarda en la base, así no hace falta configurar nada en Vercel.
 */
async function clave(): Promise<Uint8Array> {
  if (claveCache) return claveCache;
  let s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    s = (await kv.get("cd:config:session_secret")) ?? undefined;
    if (!s) {
      const nueva = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      await kv.set("cd:config:session_secret", nueva);
      s = (await kv.get("cd:config:session_secret")) ?? nueva;
    }
  }
  claveCache = new TextEncoder().encode(s);
  return claveCache;
}

export async function crearSesion(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION}s`)
    .sign(await clave());
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
  debeCambiarClave: boolean;
};

export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  await cargarAjustes();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await clave());
    const u = await db.usuarios.uno(Number(payload.uid));
    if (!u || !u.activo) return null;
    return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol, cargo: u.cargo, debeCambiarClave: Boolean(u.debeCambiarClave) };
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
