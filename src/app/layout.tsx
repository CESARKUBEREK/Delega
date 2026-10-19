import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Delega", template: "%s · Delega" },
  description: "Describe una tarea y Delega la convierte en un flujo que revisas y apruebas.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf0ec" },
    { media: "(prefers-color-scheme: dark)", color: "#121a22" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
