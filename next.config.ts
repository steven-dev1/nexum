import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Caché del navegador (3 min): al volver a una sección ya visitada se muestra al instante lo que se vio
    // (sin esqueleto) y <BackgroundRefresh> la actualiza en silencio si ya pasaron más de 5 segundos. Las acciones que modifican
    // datos (revalidatePath) vacían esta caché, así que tras crear o editar algo se ve el cambio.
    staleTimes: { dynamic: 180, static: 180 },
    serverActions: {
      // Fotos de paquetes: se comprimen en el navegador (≈300 KB), con margen de sobra.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // El service worker nunca debe quedar en caché del navegador (así las actualizaciones llegan),
        // y solo puede ejecutar código de este mismo origen.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
