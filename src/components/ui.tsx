import Link from "next/link";
import type { ReactNode } from "react";

export function Encabezado({ titulo, bajada, acciones, volver }: { titulo: string; bajada?: ReactNode; acciones?: ReactNode; volver?: { href: string; texto: string } }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="mb-2 inline-block text-sm font-medium text-muted hover:text-ink">
            ← {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-bold sm:text-3xl">{titulo}</h1>
        {bajada && <p className="mt-1 max-w-2xl text-muted">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Seccion({ titulo, acciones, children, className = "" }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      {(titulo || acciones) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-semibold">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

const TONOS = {
  neutro: "bg-surface-2 text-muted",
  marca: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  aviso: "bg-warn-soft text-warn",
  peligro: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  oro: "bg-gold-soft text-warn",
} as const;
export type Tono = keyof typeof TONOS;

export function Chip({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>{children}</span>;
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Dato({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "aviso" | "peligro" }) {
  const color = tono === "peligro" ? "text-bad" : tono === "aviso" ? "text-warn" : tono === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="card p-4">
      <p className="eyebrow">{etiqueta}</p>
      <p className={`tabular mt-1 font-display text-3xl font-bold ${color}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-sm text-muted">{detalle}</p>}
    </div>
  );
}

export function TablaScroll({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>;
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "ok" | "aviso" | "peligro"; children: ReactNode }) {
  const c = { info: "bg-info-soft text-info", ok: "bg-ok-soft text-ok", aviso: "bg-warn-soft text-warn", peligro: "bg-bad-soft text-bad" }[tono];
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${c}`}>{children}</div>;
}

/** Selector de opciones por enlaces (curso, hijo, trimestre…). */
export function Pestanas({ items, activo }: { items: { href: string; texto: string; clave: string | number }[]; activo: string | number | undefined }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <Link
          key={i.clave}
          href={i.href}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
            String(i.clave) === String(activo) ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          {i.texto}
        </Link>
      ))}
    </nav>
  );
}
