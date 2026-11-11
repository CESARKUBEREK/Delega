import type { ReactNode } from "react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

// Marco público compartido: los enlaces legales para Argentina se muestran
// desde la cabecera global, sin exigir autenticación.
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
