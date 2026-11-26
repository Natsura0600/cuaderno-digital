import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app es 100 % personalizada por usuario: todo se renderiza en cada pedido.
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
