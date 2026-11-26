"use client";

import { useActionState } from "react";
import type { ResultadoImportacion } from "./acciones";

export function Importar({
  accion, columnas, ejemplo, boton,
}: {
  accion: (prev: ResultadoImportacion, fd: FormData) => Promise<ResultadoImportacion>;
  columnas: string;
  ejemplo: string;
  boton: string;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null);
  const conClave = estado?.filas.filter((f) => f.clave) ?? [];
  return (
    <div className="grid gap-3">
      <form action={ejecutar} className="grid gap-3">
        <p className="text-sm text-muted">Columnas, en este orden: <strong className="text-ink">{columnas}</strong>. Copiá las filas desde Excel o Google Sheets y pegalas acá. La primera fila puede ser el encabezado.</p>
        <textarea name="datos" rows={8} className="input font-mono text-xs" placeholder={ejemplo} required />
        <div><button className="btn-prim" disabled={pendiente}>{pendiente ? "Cargando…" : boton}</button></div>
      </form>
      {estado && (
        <div className="grid gap-3">
          <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${estado.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{estado.msg}</p>
          {estado.filas.some((f) => !f.ok) && (
            <ul className="grid gap-1 text-sm">
              {estado.filas.filter((f) => !f.ok).map((f) => (
                <li key={f.fila} className="rounded-lg bg-bad-soft px-3 py-1.5 text-bad">Fila {f.fila} ({f.texto}): {f.detalle}</li>
              ))}
            </ul>
          )}
          {conClave.length > 0 && (
            <div className="rounded-xl border border-line p-3">
              <p className="mb-2 text-sm font-semibold">Cuentas nuevas y su contraseña inicial (se muestran una sola vez: copialas y repartilas)</p>
              <div className="overflow-x-auto">
                <table className="tabla tabular">
                  <thead><tr><th>Usuario</th><th>Contraseña inicial</th></tr></thead>
                  <tbody>{conClave.map((f) => <tr key={f.fila}><td className="select-all">{f.usuario}</td><td className="select-all font-mono">{f.clave}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
