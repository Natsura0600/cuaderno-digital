"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeftRight, Bell, Box, Bus, CalendarDays, Check, Clock, FileText, Folder, GraduationCap, HeartHandshake,
  Home, IdCard, List, LogOut, Mail, Menu, NotebookPen, Users, Wallet, X,
} from "lucide-react";
import { NAV, NOMBRE_ROL, RAPIDOS } from "./navegacion";
import { Isotipo } from "./Isotipo";
import type { Rol } from "@/db/tipos";

const ICONOS: Record<string, typeof Home> = {
  home: Home, notebook: NotebookPen, mail: Mail, check: Check, grad: GraduationCap, heart: HeartHandshake, clock: Clock,
  calendar: CalendarDays, bus: Bus, users: Users, folder: Folder, wallet: Wallet, file: FileText, list: List, box: Box,
  alert: AlertTriangle, swap: ArrowLeftRight, id: IdCard,
};

export function Shell({
  rol, nombre, cargo, colegio, sede, sinLeer, salir, children,
}: {
  rol: Rol; nombre: string; cargo: string | null; colegio: string; sede: string; sinLeer: number; salir: () => Promise<void>; children: ReactNode;
}) {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const items = NAV[rol];
  const activo = (href: string) => path === href || path.startsWith(href + "/");
  const grupos = [...new Set(items.map((i) => i.grupo))];

  const lista = (
    <nav className="flex flex-col gap-5">
      {grupos.map((g) => (
        <div key={g}>
          <p className="eyebrow mb-1.5 px-3">{g}</p>
          <ul className="flex flex-col gap-0.5">
            {items.filter((i) => i.grupo === g).map((i) => {
              const Ic = ICONOS[i.icono];
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setAbierto(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      activo(i.href) ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-2"
                    }`}
                  >
                    <Ic size={18} aria-hidden />
                    {i.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const marca = (
    <Link href="/inicio" className="flex items-center gap-3">
      <Isotipo size={38} className="shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display font-bold">Cuaderno Digital</span>
        <span className="block truncate text-xs text-muted">{colegio}</span>
      </span>
    </Link>
  );

  const pie = (
    <div className="border-t border-line pt-4">
      <p className="truncate text-sm font-semibold">{nombre}</p>
      <p className="truncate text-xs text-muted">{cargo ?? NOMBRE_ROL[rol]} · {sede}</p>
      <div className="mt-3 flex gap-2">
        <Link href="/perfil" onClick={() => setAbierto(false)} className="btn-sec btn-chico">Mi cuenta</Link>
        <form action={salir}>
          <button className="btn-sec btn-chico" type="submit"><LogOut size={14} aria-hidden /> Salir</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2">{marca}</div>
        <div className="flex-1">{lista}</div>
        <div className="px-2">{pie}</div>
      </aside>

      <div className="min-w-0">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/90 py-3 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] backdrop-blur lg:bg-bg/80 lg:px-8">
          <div className="lg:hidden">{marca}</div>
          <p className="hidden text-sm text-muted lg:block">
            {NOMBRE_ROL[rol]} · <span className="font-medium text-ink">{sede}</span>
          </p>
          <div className="flex items-center gap-1">
            <Link href="/notificaciones" className="relative grid size-10 place-items-center rounded-xl hover:bg-surface-2" aria-label={`Avisos${sinLeer ? `: ${sinLeer} sin leer` : ""}`}>
              <Bell size={20} aria-hidden />
              {sinLeer > 0 && (
                <span className="tabular absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-[#1b1203]">
                  {sinLeer > 99 ? "99+" : sinLeer}
                </span>
              )}
            </Link>
            <button className="grid size-10 place-items-center rounded-xl hover:bg-surface-2 lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú">
              <Menu size={22} aria-hidden />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl pb-28 pt-6 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* Celular: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {RAPIDOS[rol].map((href) => {
          const it = items.find((i) => i.href === href)!;
          const Ic = ICONOS[it.icono];
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${activo(href) ? "text-brand" : "text-muted"}`}>
              <Ic size={21} aria-hidden />
              <span className="max-w-full truncate px-1">{it.texto.split(" ")[0]}</span>
            </Link>
          );
        })}
        <button onClick={() => setAbierto(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted">
          <Menu size={21} aria-hidden />
          Más
        </button>
      </nav>

      {/* Celular: menú completo */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/40" aria-label="Cerrar menú" onClick={() => setAbierto(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col gap-6 overflow-y-auto bg-surface px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between px-2">
              <span className="font-display font-bold">Menú</span>
              <button onClick={() => setAbierto(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-2" aria-label="Cerrar menú">
                <X size={22} aria-hidden />
              </button>
            </div>
            <div className="flex-1">{lista}</div>
            <div className="px-2">{pie}</div>
          </div>
        </div>
      )}
    </div>
  );
}
