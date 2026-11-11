import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nexum",
    short_name: "Nexum",
    description: "Servicios al residente: paquetería, zonas comunes, asambleas y comunicados.",
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1220",
    theme_color: "#1d4ed8",
    categories: ["lifestyle", "utilities"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Paquetes", url: "/paqueteria", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Reservas", url: "/reservas", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Avisos", url: "/comunicados", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
