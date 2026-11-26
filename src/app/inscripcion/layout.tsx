import Link from "next/link";
import { APP, COLEGIO, SEDE } from "@/lib/config";
import { Perlas } from "@/components/Shell";

export default function LayoutPublico({ children }: LayoutProps<"/inscripcion">) {
  return (
    <div className="min-h-dvh">
      <header className="bg-brand text-brand-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 py-4 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">
          <Link href="/inscripcion" className="flex items-center gap-3">
            <Perlas size={26} />
            <span className="leading-tight"><span className="block font-display font-bold">{COLEGIO}</span><span className="block text-xs opacity-80">{SEDE} · Matrícula</span></span>
          </Link>
          <Link href="/ingresar" className="text-sm font-semibold underline-offset-4 hover:underline">Ingresar a {APP}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl py-8 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]">{children}</main>
    </div>
  );
}
