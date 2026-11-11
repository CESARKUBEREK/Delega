import type { ReactNode } from "react"
import Link from "next/link"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

// Marco del sitio público: los accesos de derechos del consumidor permanecen
// visibles sin autenticación en todas las páginas comerciales.
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <nav aria-label="Derechos de consumidores de Argentina" className="border-b border-[var(--ms-line)] bg-[var(--ms-white)]">
        <div className="site-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-xs">
          <span className="font-medium text-[var(--ms-graphite)]">Argentina · Gestión de derechos del consumidor</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
            <Link href="/boton-de-arrepentimiento" className="underline underline-offset-4">Botón de arrepentimiento</Link>
            <Link href="/boton-de-baja" className="underline underline-offset-4">Botón de baja del servicio</Link>
          </span>
        </div>
      </nav>
      <div id="contenido" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter />
    </div>
  )
}
