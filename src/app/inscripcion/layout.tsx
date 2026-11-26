import Link from "next/link";
import { APP, COLEGIO, SEDE } from "@/lib/config";
import { Isotipo } from "@/components/Isotipo";

export default function LayoutPublico({ children }: LayoutProps<"/inscripcion">) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 py-3 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">
          <Link href="/inscripcion" className="flex items-center gap-3">
            <Isotipo size={36} />
            <span className="leading-tight"><span className="block font-display font-bold">{COLEGIO}</span><span className="block text-xs text-muted">{SEDE} · Matrícula</span></span>
          </Link>
          <Link href="/ingresar" className="link text-sm">Ingresar a {APP}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl py-8 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">{children}</main>
    </div>
  );
}
