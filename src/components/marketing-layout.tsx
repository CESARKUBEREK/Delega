import type { ReactNode } from "react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

// Marco del sitio público: cabecera, contenido y pie. La app autenticada
// tiene su propia navegación (src/app/w).
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <div id="contenido" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter />
    </div>
  )
}
