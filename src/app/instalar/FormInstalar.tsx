"use client";

import { useActionState } from "react";
import { crearPrimerDirectivo } from "./acciones";

export function FormInstalar() {
  const [estado, accion, pendiente] = useActionState(crearPrimerDirectivo, null);
  return (
    <form action={accion} className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="campo"><span>Nombre</span><input id="in-nombre" name="nombre" className="input" required /></label>
        <label className="campo"><span>Apellido</span><input id="in-apellido" name="apellido" className="input" required /></label>
      </div>
      <label className="campo"><span>Cargo</span><input id="in-cargo" name="cargo" className="input" placeholder="Directora, Secretario…" /></label>
      <label className="campo"><span>E-mail</span><input id="in-email" name="email" type="email" className="input" required autoComplete="email" /></label>
      <label className="campo"><span>Contraseña (mínimo 8 caracteres)</span><input id="in-clave" name="clave" type="password" minLength={8} className="input" required autoComplete="new-password" /></label>
      {estado?.error && <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{estado.error}</p>}
      <button className="btn-prim" disabled={pendiente}>{pendiente ? "Creando…" : "Crear cuenta y empezar"}</button>
    </form>
  );
}
