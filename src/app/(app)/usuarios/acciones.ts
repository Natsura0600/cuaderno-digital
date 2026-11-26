"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db, kv, ROLES, type Rol } from "@/db";
import { requerir } from "@/lib/auth";
import { actualizarCargoDocente } from "@/lib/materias";
import type { Resultado } from "@/components/formularios";

const claveTemporal = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const nuevoQr = () => `CD-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

async function crearUsuario(datos: { nombre: string; apellido: string; email: string; rol: Rol; cargo: string | null; telefono: string | null }, clave = claveTemporal()) {
  const u = await db.usuarios.insertar({ ...datos, passwordHash: await bcrypt.hash(clave, 10), activo: true, creado: new Date().toISOString(), debeCambiarClave: true });
  await db.indexarEmail(datos.email, u.id);
  return { u, clave };
}

async function crearAlumno(datos: { nombre: string; apellido: string; dni: string; cursoId: number; fechaNac: string | null }) {
  const codigoQr = nuevoQr();
  const a = await db.alumnos.insertar({ ...datos, codigoQr, activo: true });
  await db.indexarQr(codigoQr, a.id);
  return a;
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
  return { ok: true, msg: `Cuenta creada. Usuario: ${email} · contraseña inicial: ${clave} (anotala: no se vuelve a mostrar; se le pide cambiarla al entrar).` };
}

export async function editarUsuario(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await requerir("directivo");
  const u = await db.usuarios.uno(id);
  if (!u) return { ok: false, msg: "La cuenta no existe." };
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const email = v("email").toLowerCase();
  const rol = (v("rol") || u.rol) as Rol;
  if (!v("nombre") || !v("apellido")) return { ok: false, msg: "Completá nombre y apellido." };
  if (!emailValido(email)) return { ok: false, msg: "Revisá el e-mail." };
  if (!ROLES.includes(rol)) return { ok: false, msg: "Rol inválido." };
  if (id === yo.id && rol !== "directivo") return { ok: false, msg: "No podés quitarte el rol directivo a vos mismo." };
  if (email !== u.email) {
    const otro = await db.idPorEmail(email);
    if (otro && otro !== id) return { ok: false, msg: "Ese e-mail ya lo usa otra cuenta." };
    await db.indexarEmail(email, id);
    await kv.del([`cd:email:${u.email.toLowerCase()}`]);
  }
  await db.usuarios.actualizar(id, { nombre: v("nombre"), apellido: v("apellido"), email, rol, cargo: v("cargo") || null, telefono: v("telefono") || null });
  if (rol === "profesor") await actualizarCargoDocente(id);
  revalidatePath("/usuarios");
  return { ok: true, msg: "Datos guardados." };
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
  if (emailFam && !emailValido(emailFam)) return { ok: false, msg: "Revisá el e-mail del adulto responsable." };
  const a = await crearAlumno({ nombre: v("nombre"), apellido: v("apellido"), dni, fechaNac: v("fechaNac") || null, cursoId });
  if (!emailFam) {
    revalidatePath("/usuarios");
    return { ok: true, msg: `${a.nombre} ${a.apellido} agregado. Podés vincular a la familia más tarde.` };
  }
  let padreId = await db.idPorEmail(emailFam);
  let extra = " Se vinculó a la cuenta familiar existente.";
  if (!padreId) {
    const [n, ...ap] = (v("nombreFamilia") || "Familia").split(" ");
    const r = await crearUsuario({ nombre: n, apellido: ap.join(" ") || v("apellido"), email: emailFam, rol: "padre", cargo: null, telefono: v("telefonoFamilia") || null }, dni);
    padreId = r.u.id;
    extra = ` Cuenta familiar: ${emailFam} · contraseña inicial: el DNI del alumno (${dni}).`;
  }
  await db.familias.insertar({ padreId, alumnoId: a.id, vinculo: v("vinculo") || "Responsable" });
  revalidatePath("/usuarios");
  return { ok: true, msg: `${a.nombre} ${a.apellido} agregado.${extra}` };
}

export async function editarAlumno(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  const dni = v("dni").replace(/\D/g, "");
  const cursoId = Number(v("curso"));
  if (!v("nombre") || !v("apellido")) return { ok: false, msg: "Completá nombre y apellido." };
  if (!/^\d{7,9}$/.test(dni)) return { ok: false, msg: "Revisá el DNI." };
  if ((await db.alumnos.todos((a) => a.dni === dni && a.id !== id)).length) return { ok: false, msg: "Ese DNI ya es de otro alumno." };
  if (!(await db.cursos.uno(cursoId))) return { ok: false, msg: "Curso inválido." };
  await db.alumnos.actualizar(id, { nombre: v("nombre"), apellido: v("apellido"), dni, fechaNac: v("fechaNac") || null, cursoId });
  revalidatePath("/usuarios");
  return { ok: true, msg: "Datos del alumno guardados." };
}

export async function vincularFamilia(alumnoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  await requerir("directivo");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { ok: false, msg: "Revisá el e-mail." };
  const a = await db.alumnos.uno(alumnoId);
  let padreId = await db.idPorEmail(email);
  let extra = "";
  if (!padreId) {
    const [n, ...ap] = (String(fd.get("nombre") ?? "").trim() || "Familia").split(" ");
    const r = await crearUsuario({ nombre: n, apellido: ap.join(" ") || a?.apellido || "", email, rol: "padre", cargo: null, telefono: null }, a?.dni);
    padreId = r.u.id;
    extra = ` Contraseña inicial: el DNI del alumno (${a?.dni}).`;
  }
  if ((await db.familias.todos((f) => f.padreId === padreId && f.alumnoId === alumnoId)).length) return { ok: false, msg: "Ya estaba vinculado." };
  await db.familias.insertar({ padreId, alumnoId, vinculo: String(fd.get("vinculo") ?? "").trim() || "Responsable" });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Vinculado a ${email}.${extra}` };
}

export async function desvincular(familiaId: number) {
  await requerir("directivo");
  await db.familias.borrar(familiaId);
  revalidatePath("/usuarios");
}

export async function activar(usuarioId: number, activo: boolean) {
  const yo = await requerir("directivo");
  if (yo.id === usuarioId) return;
  await db.usuarios.actualizar(usuarioId, { activo });
  revalidatePath("/usuarios");
}

export async function bajaAlumno(alumnoId: number, activo = false) {
  await requerir("directivo");
  await db.alumnos.actualizar(alumnoId, { activo });
  revalidatePath("/usuarios");
}

export async function resetClave(usuarioId: number, _: Resultado): Promise<Resultado> {
  await requerir("directivo");
  const u = await db.usuarios.uno(usuarioId);
  if (!u) return { ok: false, msg: "No existe." };
  const clave = claveTemporal();
  await db.usuarios.actualizar(usuarioId, { passwordHash: await bcrypt.hash(clave, 10), debeCambiarClave: true, activo: true });
  return { ok: true, msg: `Nueva contraseña de ${u.email}: ${clave} (se le pide cambiarla al entrar).` };
}

/* ───────────── Importación masiva ───────────── */

export type FilaImportada = { fila: number; texto: string; ok: boolean; detalle: string; usuario?: string; clave?: string };
export type ResultadoImportacion = { ok: boolean; msg: string; filas: FilaImportada[] } | null;

function partirFilas(texto: string) {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = lineas.some((l) => l.includes("\t")) ? "\t" : lineas.some((l) => l.includes(";")) ? ";" : ",";
  return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

const clave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[°º\s.]/g, "").replace("grado", "").replace("salade", "sala");

/**
 * Columnas: Apellido · Nombre · DNI · Curso · E-mail del responsable · Nombre del responsable · Teléfono · Vínculo
 * (las últimas cuatro son opcionales). Se puede pegar directo desde Excel o Google Sheets.
 */
export async function importarAlumnos(_: ResultadoImportacion, fd: FormData): Promise<ResultadoImportacion> {
  await requerir("directivo");
  const filas = partirFilas(String(fd.get("datos") ?? ""));
  if (!filas.length) return { ok: false, msg: "Pegá al menos una fila.", filas: [] };
  const cursos = await db.cursos.todos();
  const porNombre = new Map(cursos.map((c) => [clave(c.nombre), c] as const));
  const out: FilaImportada[] = [];
  let creados = 0;
  for (const [i, f] of filas.entries()) {
    if (i === 0 && /apellido/i.test(f[0] ?? "")) continue; // encabezado
    const [apellido, nombre, dniRaw, cursoTxt, emailRaw, nombreFam, tel, vinculo] = f;
    const texto = f.slice(0, 4).join(" · ");
    const dni = (dniRaw ?? "").replace(/\D/g, "");
    const curso = porNombre.get(clave(cursoTxt ?? ""));
    const email = (emailRaw ?? "").toLowerCase();
    if (!apellido || !nombre) { out.push({ fila: i + 1, texto, ok: false, detalle: "Falta apellido o nombre" }); continue; }
    if (!/^\d{7,9}$/.test(dni)) { out.push({ fila: i + 1, texto, ok: false, detalle: "DNI inválido" }); continue; }
    if (!curso) { out.push({ fila: i + 1, texto, ok: false, detalle: `No existe el curso «${cursoTxt ?? ""}»` }); continue; }
    if ((await db.alumnos.todos((a) => a.dni === dni)).length) { out.push({ fila: i + 1, texto, ok: false, detalle: "Ya existe un alumno con ese DNI" }); continue; }
    if (email && !emailValido(email)) { out.push({ fila: i + 1, texto, ok: false, detalle: "E-mail del responsable inválido" }); continue; }
    const a = await crearAlumno({ nombre, apellido, dni, cursoId: curso.id, fechaNac: null });
    creados++;
    if (!email) { out.push({ fila: i + 1, texto, ok: true, detalle: `Alumno en ${curso.nombre}, sin familia vinculada` }); continue; }
    let padreId = await db.idPorEmail(email);
    let detalle = `Alumno en ${curso.nombre}, vinculado a una cuenta existente`;
    let clv: string | undefined;
    if (!padreId) {
      const [n, ...ap] = (nombreFam || "Familia").split(" ");
      const r = await crearUsuario({ nombre: n, apellido: ap.join(" ") || apellido, email, rol: "padre", cargo: null, telefono: tel || null }, dni);
      padreId = r.u.id;
      clv = r.clave;
      detalle = `Alumno en ${curso.nombre} y cuenta familiar nueva`;
    }
    await db.familias.insertar({ padreId, alumnoId: a.id, vinculo: vinculo || "Responsable" });
    out.push({ fila: i + 1, texto, ok: true, detalle, usuario: email, clave: clv });
  }
  revalidatePath("/usuarios");
  const errores = out.filter((x) => !x.ok).length;
  return { ok: errores === 0, msg: `Se cargaron ${creados} alumno${creados === 1 ? "" : "s"}.${errores ? ` ${errores === 1 ? "1 fila tuvo" : `${errores} filas tuvieron`} errores.` : ""}`, filas: out };
}

/** Columnas: Apellido · Nombre · E-mail · Rol (docente, preceptor, directivo) · Cargo · Teléfono */
export async function importarEquipo(_: ResultadoImportacion, fd: FormData): Promise<ResultadoImportacion> {
  await requerir("directivo");
  const filas = partirFilas(String(fd.get("datos") ?? ""));
  if (!filas.length) return { ok: false, msg: "Pegá al menos una fila.", filas: [] };
  const ROL: Record<string, Rol> = { docente: "profesor", profesor: "profesor", profesora: "profesor", preceptor: "preceptor", preceptora: "preceptor", directivo: "directivo", directora: "directivo", director: "directivo", secretaria: "directivo", secretario: "directivo" };
  const out: FilaImportada[] = [];
  for (const [i, f] of filas.entries()) {
    if (i === 0 && /apellido/i.test(f[0] ?? "")) continue;
    const [apellido, nombre, emailRaw, rolTxt, cargo, tel] = f;
    const texto = f.slice(0, 4).join(" · ");
    const email = (emailRaw ?? "").toLowerCase();
    const rol = ROL[clave(rolTxt ?? "docente") || "docente"];
    if (!apellido || !nombre) { out.push({ fila: i + 1, texto, ok: false, detalle: "Falta apellido o nombre" }); continue; }
    if (!emailValido(email)) { out.push({ fila: i + 1, texto, ok: false, detalle: "E-mail inválido" }); continue; }
    if (!rol) { out.push({ fila: i + 1, texto, ok: false, detalle: `Rol «${rolTxt}» desconocido (usá docente, preceptor o directivo)` }); continue; }
    if (await db.idPorEmail(email)) { out.push({ fila: i + 1, texto, ok: false, detalle: "Ya existe una cuenta con ese e-mail" }); continue; }
    const r = await crearUsuario({ nombre, apellido, email, rol, cargo: cargo || null, telefono: tel || null });
    out.push({ fila: i + 1, texto, ok: true, detalle: rol === "profesor" ? "Docente" : rol === "preceptor" ? "Preceptoría" : "Directivo", usuario: email, clave: r.clave });
  }
  revalidatePath("/usuarios");
  const ok = out.filter((x) => x.ok).length;
  return { ok: ok === out.length, msg: `Se crearon ${ok} cuenta${ok === 1 ? "" : "s"}.${out.length - ok ? ` ${out.length - ok === 1 ? "1 fila tuvo" : `${out.length - ok} filas tuvieron`} errores.` : ""}`, filas: out };
}

