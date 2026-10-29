import type { Metadata, Viewport } from "next"
import { PwaRegister } from "@/components/pwa-register"
import "@fontsource-variable/montserrat/wght.css"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Marcha Solo", template: "%s · Marcha Solo" },
  description: "Tu negocio, en automático. Describe una tarea y Marcha Solo la convierte en un flujo que revisas y apruebas.",
  applicationName: "Marcha Solo",
  robots: { index: false, follow: false },
  // App instalable en el iPhone: el manifiesto lo genera app/manifest.ts.
  appleWebApp: { capable: true, title: "Marcha Solo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  // Pantalla completa en móviles con muesca; los márgenes usan env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#f7f8fc" },
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
