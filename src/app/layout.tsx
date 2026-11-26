import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { APP, COLEGIO } from "@/lib/config";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

// Toda la app depende de la sesión y de la base: nada se congela en la compilación.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${APP} · ${COLEGIO}`, template: `%s · ${APP}` },
  description: `Sistema de organización escolar de ${COLEGIO}: asistencia, notas, comunicados, calendario y administración.`,
  applicationName: APP,
  appleWebApp: { capable: true, title: APP, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2e7d32" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1610" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
