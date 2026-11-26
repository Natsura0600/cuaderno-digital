"use client";

import { useState, useTransition } from "react";
import type { EstadoAsistencia } from "@/db/tipos";
import { guardarAsistencia } from "./acciones";

const CICLO: EstadoAsistencia[] = ["presente", "ausente", "tarde", "justificado"];
const ESTILO: Record<EstadoAsistencia, { txt: string; cls: string; corto: string }> = {
  presente: { txt: "Presente", corto: "P", cls: "bg-ok-soft text-ok border-ok/30" },
  ausente: { txt: "Ausente", corto: "A", cls: "bg-bad-soft text-bad border-bad/30" },
  tarde: { txt: "Tarde", corto: "T", cls: "bg-warn-soft text-warn border-warn/30" },
  justificado: { txt: "Justificado", corto: "J", cls: "bg-info-soft text-info border-info/30" },
};

type Fila = { id: number; nombre: string; estado: EstadoAsistencia | null; metodo: string | null; faltas: number; limite: number; aviso: number };

export function TomaAsistencia({ cursoId, fecha, filas }: { cursoId: number; fecha: string; filas: Fila[] }) {
  const [marcas, setMarcas] = useState<Record<number, EstadoAsistencia | null>>(() => Object.fromEntries(filas.map((f) => [f.id, f.estado])));
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const sinMarcar = filas.filter((f) => !marcas[f.id]).length;
  const cambiar = (id: number) => {
    setMsg(null);
    setMarcas((m) => ({ ...m, [id]: CICLO[(CICLO.indexOf(m[id] ?? "ausente") + 1) % CICLO.length] }));
  };
  const cuenta = (e: EstadoAsistencia) => Object.values(marcas).filter((x) => x === e).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-sec"
          onClick={() => setMarcas((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v ?? "presente"])))}
        >
          Marcar el resto como presentes
        </button>
        <span className="text-sm text-muted">Tocá el estado de cada alumno para cambiarlo: P → A → T → J.</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {filas.map((f) => {
          const e = marcas[f.id];
          const st = e ? ESTILO[e] : null;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => cambiar(f.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${st ? st.cls : "border-line bg-surface hover:bg-surface-2"}`}
                aria-label={`${f.nombre}: ${st?.txt ?? "sin marcar"}. Tocá para cambiar.`}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-full border font-display text-lg font-bold ${st ? "border-current" : "border-dashed border-line text-muted"}`}>
                  {st?.corto ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{f.nombre}</span>
                  <span className={`block text-xs ${f.faltas >= f.aviso ? "font-semibold text-warn" : "text-muted"}`}>
                    {f.faltas.toLocaleString("es-AR")} / {f.limite} faltas en el año{f.metodo === "qr" ? " · ingresó con QR" : ""}
                  </span>
                </span>
                <span className="text-xs font-semibold">{st?.txt ?? "Sin marcar"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-20 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg lg:bottom-4">
        <p className="tabular text-sm">
          <strong className="text-ok">{cuenta("presente")}</strong> presentes · <strong className="text-bad">{cuenta("ausente")}</strong> ausentes ·{" "}
          <strong className="text-warn">{cuenta("tarde")}</strong> tarde · <strong className="text-info">{cuenta("justificado")}</strong> justificados
          {sinMarcar > 0 && <span className="text-muted"> · {sinMarcar} sin marcar</span>}
        </p>
        <button
          className="btn-prim"
          disabled={pendiente || sinMarcar === filas.length}
          onClick={() =>
            iniciar(async () => {
              const ok = Object.fromEntries(Object.entries(marcas).filter(([, v]) => v)) as Record<number, EstadoAsistencia>;
              setMsg(await guardarAsistencia(cursoId, fecha, ok));
            })
          }
        >
          {pendiente ? "Guardando…" : "Guardar y avisar a las familias"}
        </button>
        {msg && <p role="status" className={`w-full rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{msg.msg}</p>}
      </div>
    </div>
  );
}
