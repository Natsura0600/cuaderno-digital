import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requerir } from "@/lib/auth";
import { NOMBRE_ROL } from "@/components/navegacion";
import { Aviso, Encabezado, Seccion } from "@/components/ui";
import { Enviar, FormAccion, type Resultado } from "@/components/formularios";
import { usaUpstash } from "@/db";

export const metadata = { title: "Mi cuenta" };

async function cambiarClave(_: Resultado, fd: FormData): Promise<Resultado> {
  "use server";
  const u = await requerir();
  const actual = String(fd.get("actual") ?? "");
  const nueva = String(fd.get("nueva") ?? "");
  const repetir = String(fd.get("repetir") ?? "");
  const reg = await db.usuarios.uno(u.id);
  if (!reg || !(await bcrypt.compare(actual, reg.passwordHash))) return { ok: false, msg: "La contraseña actual no es correcta." };
  if (nueva.length < 8) return { ok: false, msg: "La nueva contraseña tiene que tener al menos 8 caracteres." };
  if (nueva !== repetir) return { ok: false, msg: "Las contraseñas nuevas no coinciden." };
  await db.usuarios.actualizar(u.id, { passwordHash: await bcrypt.hash(nueva, 10), debeCambiarClave: false });
  revalidatePath("/", "layout");
  return { ok: true, msg: "Contraseña actualizada." };
}

async function guardarTelefono(_: Resultado, fd: FormData): Promise<Resultado> {
  "use server";
  const u = await requerir();
  const tel = String(fd.get("telefono") ?? "").trim().slice(0, 30);
  await db.usuarios.actualizar(u.id, { telefono: tel || null });
  return { ok: true, msg: "Teléfono guardado." };
}

export default async function Perfil() {
  const u = await requerir();
  const reg = await db.usuarios.uno(u.id);
  return (
    <>
      <Encabezado titulo="Mi cuenta" bajada={`${u.nombre} ${u.apellido} · ${u.cargo ?? NOMBRE_ROL[u.rol]}`} />
      {u.debeCambiarClave && <div className="mb-4"><Aviso tono="aviso">Estás usando una contraseña inicial. Elegí una propia para proteger tu cuenta.</Aviso></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Seccion titulo="Datos de contacto">
          <p className="mb-3 text-sm"><span className="text-muted">E-mail:</span> {u.email}</p>
          <FormAccion accion={guardarTelefono} className="grid gap-3" reiniciar={false}>
            <label className="campo"><span>Teléfono</span><input id="telefono" name="telefono" defaultValue={reg?.telefono ?? ""} className="input" inputMode="tel" /></label>
            <div><Enviar className="btn-sec">Guardar</Enviar></div>
          </FormAccion>
        </Seccion>
        <Seccion titulo="Cambiar contraseña">
          <FormAccion accion={cambiarClave} className="grid gap-3">
            <label className="campo"><span>Contraseña actual</span><input id="actual" name="actual" type="password" autoComplete="current-password" className="input" /></label>
            <label className="campo"><span>Nueva contraseña</span><input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} className="input" /></label>
            <label className="campo"><span>Repetila</span><input id="repetir" name="repetir" type="password" autoComplete="new-password" className="input" /></label>
            <div><Enviar>Cambiar contraseña</Enviar></div>
          </FormAccion>
        </Seccion>
        <Seccion titulo="Instalar la app">
          <p className="text-sm text-muted">En el celular, abrí este sitio y elegí <strong>Agregar a la pantalla de inicio</strong> (Android: menú ⋮ de Chrome · iPhone: botón Compartir de Safari). Queda como una app más.</p>
          {u.rol === "directivo" && <p className="mt-3 text-xs text-muted">Base de datos: {usaUpstash ? "Upstash Redis" : "Redis local (desarrollo)"}</p>}
        </Seccion>
      </div>
    </>
  );
}
