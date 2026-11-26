"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db, ROLES, type Rol } from "@/db";
import { requerir } from "@/lib/auth";
import type { Resultado } from "@/components/formularios";

const claveTemporal = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function crearUsuario(datos: { nombre: string; apellido: string; email: string; rol: Rol; cargo: string | null; telefono: string | null }) {
  const clave = claveTemporal();
  const u = await db.usuarios.insertar({ ...datos, passwordHash: await bcrypt.hash(clave, 10), activo: true, creado: new Date().toISOString() });
  await db.indexarEmail(datos.email, u.id);
  return { u, clave };
}

export async function altaPersonal(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const email = v("email").toLowerCase();
  const rol = v("rol") as Rol;
  if (!v("nombre") || !v("apellido")) return { ok: false, msg: "Completá nombre y apellido." };
  if (!emailValido(email)) return { ok: false, msg: "Revisá el e-mail." };
  if (!ROLES.includes(rol) || rol === "padre") return { ok: false, msg: "Elegí el rol." };
  if (await db.idPorEmail(email)) return { ok: false, msg: "Ya existe una cuenta con ese e-mail." };
  const { clave } = await crearUsuario({ nombre: v("nombre"), apellido: v("apellido"), email, rol, cargo: v("cargo") || null, telefono: v("telefono") || null });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Cuenta creada. Usuario: ${email} · contraseña inicial: ${clave} (anotala: no se vuelve a mostrar).` };
}

export async function altaAlumno(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const cursoId = Number(v("curso"));
  const dni = v("dni").replace(/\D/g, "");
  const emailFam = v("emailFamilia").toLowerCase();
  if (!v("nombre") || !v("apellido")) return { ok: false, msg: "Completá nombre y apellido del alumno." };
  if (!/^\d{7,9}$/.test(dni)) return { ok: false, msg: "Revisá el DNI." };
  if (!(await db.cursos.uno(cursoId))) return { ok: false, msg: "Elegí el curso." };
  if ((await db.alumnos.todos((a) => a.dni === dni)).length) return { ok: false, msg: "Ya hay un alumno con ese DNI." };
  if (!emailValido(emailFam)) return { ok: false, msg: "Indicá el e-mail del adulto responsable." };
  const codigoQr = `CD-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const a = await db.alumnos.insertar({ nombre: v("nombre"), apellido: v("apellido"), dni, fechaNac: v("fechaNac") || null, cursoId, codigoQr, activo: true });
  await db.indexarQr(codigoQr, a.id);
  let padreId = await db.idPorEmail(emailFam);
  let extra = " Se vinculó a la cuenta familiar existente.";
  if (!padreId) {
    const [n, ...ap] = (v("nombreFamilia") || "Familia").split(" ");
    const r = await crearUsuario({ nombre: n, apellido: ap.join(" ") || v("apellido"), email: emailFam, rol: "padre", cargo: null, telefono: v("telefonoFamilia") || null });
    padreId = r.u.id;
    extra = ` Cuenta familiar: ${emailFam} · contraseña inicial: ${r.clave}.`;
  }
  await db.familias.insertar({ padreId, alumnoId: a.id, vinculo: v("vinculo") || "Responsable" });
  revalidatePath("/usuarios");
  return { ok: true, msg: `${a.nombre} ${a.apellido} agregado.${extra}` };
}

export async function vincularFamilia(alumnoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { ok: false, msg: "Revisá el e-mail." };
  let padreId = await db.idPorEmail(email);
  let extra = "";
  if (!padreId) {
    const a = await db.alumnos.uno(alumnoId);
    const r = await crearUsuario({ nombre: String(fd.get("nombre") ?? "Familia").trim() || "Familia", apellido: a?.apellido ?? "", email, rol: "padre", cargo: null, telefono: null });
    padreId = r.u.id;
    extra = ` Contraseña inicial: ${r.clave}.`;
  }
  if ((await db.familias.todos((f) => f.padreId === padreId && f.alumnoId === alumnoId)).length) return { ok: false, msg: "Ya estaba vinculado." };
  await db.familias.insertar({ padreId, alumnoId, vinculo: String(fd.get("vinculo") ?? "").trim() || "Responsable" });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Vinculado a ${email}.${extra}` };
}

export async function cambiarCurso(alumnoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const cursoId = Number(fd.get("curso"));
  if (!(await db.cursos.uno(cursoId))) return { ok: false, msg: "Curso inválido." };
  await db.alumnos.actualizar(alumnoId, { cursoId });
  revalidatePath("/usuarios");
  return { ok: true, msg: "Curso actualizado." };
}

export async function activar(usuarioId: number, activo: boolean) {
  const yo = await requerir("directivo");
  if (yo.id === usuarioId) return;
  await db.usuarios.actualizar(usuarioId, { activo });
  revalidatePath("/usuarios");
}

export async function bajaAlumno(alumnoId: number) {
  await requerir("directivo");
  await db.alumnos.actualizar(alumnoId, { activo: false });
  revalidatePath("/usuarios");
}

export async function resetClave(usuarioId: number, _: Resultado): Promise<Resultado> {
  await requerir("directivo");
  const u = await db.usuarios.uno(usuarioId);
  if (!u) return { ok: false, msg: "No existe." };
  const clave = claveTemporal();
  await db.usuarios.actualizar(usuarioId, { passwordHash: await bcrypt.hash(clave, 10) });
  return { ok: true, msg: `Nueva contraseña de ${u.email}: ${clave}` };
}

export async function altaCurso(_: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const anio = Number(fd.get("anio"));
  const division = String(fd.get("division") ?? "").trim().toUpperCase();
  const nivel = String(fd.get("nivel")) as "inicial" | "primaria" | "secundaria";
  if (!(anio >= 1 && anio <= 7) || !division) return { ok: false, msg: "Indicá año y división." };
  const nombre = `${anio}° ${division}`;
  if ((await db.cursos.todos((c) => c.nombre === nombre && c.nivel === nivel)).length) return { ok: false, msg: "Ese curso ya existe." };
  const c = await db.cursos.insertar({ nombre, nivel, anio, division, turno: fd.get("turno") === "tarde" ? "tarde" : "mañana", preceptorId: Number(fd.get("preceptor")) || null });
  await db.aulas.insertar({ nombre: `Aula ${c.nombre}`, tipo: "aula", capacidad: 30 });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Curso ${nombre} creado. Ahora agregale las materias.` };
}

export async function asignarPreceptor(cursoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  await db.cursos.actualizar(cursoId, { preceptorId: Number(fd.get("preceptor")) || null });
  revalidatePath("/usuarios");
  return { ok: true, msg: "Preceptor asignado." };
}

export async function altaMateria(cursoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const nombre = String(fd.get("nombre") ?? "").trim();
  const horas = Number(fd.get("horas"));
  if (!nombre || !(horas >= 1 && horas <= 10)) return { ok: false, msg: "Indicá la materia y sus horas semanales." };
  const m = await db.materias.insertar({ nombre, area: String(fd.get("area") ?? "").trim() || nombre, cursoId, profesorId: Number(fd.get("profesor")) || null, horasSemanales: horas });
  await db.criterios.insertarVarios([{ materiaId: m.id, nombre: "Trabajos prácticos", peso: 1 }, { materiaId: m.id, nombre: "Evaluaciones", peso: 2 }, { materiaId: m.id, nombre: "Proceso y participación", peso: 1 }]);
  revalidatePath("/usuarios");
  return { ok: true, msg: `${nombre} agregada. Generá de nuevo los horarios para ubicarla en la grilla.` };
}

export async function asignarDocente(materiaId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  await db.materias.actualizar(materiaId, { profesorId: Number(fd.get("profesor")) || null, horasSemanales: Math.max(1, Number(fd.get("horas")) || 1) });
  revalidatePath("/usuarios");
  return { ok: true, msg: "Guardado." };
}
