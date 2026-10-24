import type { MetadataRoute } from "next"

// Manifiesto de la app instalable (PWA). La app abre en /abrir, que lleva al
// chat del último espacio usado.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/abrir",
    name: "Orkesta",
    short_name: "Orkesta",
    description: "Tu negocio, en automático. Pide tareas por texto o voz y aprueba lo que se escribe o se envía.",
    lang: "es",
    dir: "ltr",
    start_url: "/abrir",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1F3B",
    theme_color: "#0B1F3B",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
