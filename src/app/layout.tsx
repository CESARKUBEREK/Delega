import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Orkesta", template: "%s · Orkesta" },
  description: "Tu negocio, en automático. Describe una tarea y Orkesta la convierte en un flujo que revisas y apruebas.",
  applicationName: "Orkesta",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#071528" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
