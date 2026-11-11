import type { Metadata, Viewport } from "next"
import { PwaRegister } from "@/components/pwa-register"
import "@fontsource-variable/outfit/wght.css"
import "./globals.css"
import "./accessibility.css"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://marchasolo.com").replace(/\/+$/, "")

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "MarchaSolo", template: "%s · MarchaSolo" },
  description: "Tu negocio, en automático. MarchaSolo conecta aplicaciones y organiza tareas con inteligencia artificial.",
  openGraph: {
    type: "website",
    locale: "es",
    siteName: "MarchaSolo",
    title: "MarchaSolo · Tu negocio, en automático",
    description: "MarchaSolo conecta las aplicaciones del negocio y automatiza tareas cotidianas con inteligencia artificial.",
  },
  twitter: { card: "summary_large_image" },
  applicationName: "MarchaSolo",
  robots: { index: false, follow: false },
  // App instalable en el iPhone: el manifiesto lo genera app/manifest.ts.
  appleWebApp: { capable: true, title: "MarchaSolo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  // Pantalla completa en móviles con muesca; los márgenes usan env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b1f3b" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1f3b" },
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
