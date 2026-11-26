import type { MetadataRoute } from "next";
import { APP, COLEGIO } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP} · ${COLEGIO}`,
    short_name: APP,
    description: "Asistencia, notas, comunicados y calendario del colegio.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e7d32",
    lang: "es-AR",
    icons: [
      { src: "/iconos/192", sizes: "192x192", type: "image/png" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
