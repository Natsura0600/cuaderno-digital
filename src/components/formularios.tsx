"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type Resultado = { ok: boolean; msg: string } | null;

export function Enviar({ children, className = "btn-prim", pendiente = "Guardando…" }: { children: ReactNode; className?: string; pendiente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendiente : children}
    </button>
  );
}

/** Formulario que muestra el resultado de la acción (éxito o error) debajo. */
export function FormAccion({
  accion,
  children,
  className = "",
  reiniciar = true,
}: {
  accion: (prev: Resultado, fd: FormData) => Promise<Resultado>;
  children: ReactNode;
  className?: string;
  reiniciar?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && reiniciar) ref.current?.reset();
  }, [estado, reiniciar]);
  return (
    <form ref={ref} action={ejecutar} className={className}>
      {children}
      {estado && (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${estado.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
          {estado.msg}
        </p>
      )}
    </form>
  );
}

export function Confirmar({ children, mensaje, className = "btn-peligro btn-chico" }: { children: ReactNode; mensaje: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        const b = e.currentTarget;
        if (b.dataset.confirmado === "1") return;
        e.preventDefault();
        b.dataset.confirmado = "1";
        const original = b.textContent;
        b.textContent = mensaje;
        setTimeout(() => {
          b.dataset.confirmado = "";
          b.textContent = original;
        }, 3500);
      }}
    >
      {children}
    </button>
  );
}
