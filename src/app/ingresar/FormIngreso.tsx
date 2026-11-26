"use client";

import { useActionState } from "react";
import { ingresar } from "../acciones-sesion";

export function FormIngreso() {
  const [estado, accion, pendiente] = useActionState(ingresar, null);
  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <label className="campo">
        <span>E-mail</span>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </label>
      <label className="campo">
        <span>Contraseña</span>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required className="input" />
      </label>
      {estado?.error && <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{estado.error}</p>}
      <button className="btn-prim mt-1 py-3" disabled={pendiente}>{pendiente ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
