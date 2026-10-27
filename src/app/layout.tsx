import type { Metadata, Viewport } from "next"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Orkesta", template: "%s · Orkesta" },
  description: "Tu negocio, en automático. Describe una tarea y Orkesta la convierte en un flujo que revisas y apruebas.",
  applicationName: "Orkesta",
  robots: { index: false, follow: false },
  // App instalable en el iPhone: el manifiesto lo genera app/manifest.ts.
  appleWebApp: { capable: true, title: "Orkesta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  // Pantalla completa en móviles con muesca; los márgenes usan env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#f3f6fa" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
