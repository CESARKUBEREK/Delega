import type { ReactNode } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-site">
      <header className="marketing-header">
        <Link href="/para-que-sirve" aria-label="Marcha Solo, inicio" className="marketing-brand">
          <Logo size={32} />
        </Link>
        <nav aria-label="Navegación principal" className="marketing-nav">
          <Link href="/para-que-sirve">Qué puedes hacer</Link>
          <Link href="/como-empezar">Cómo empezar</Link>
        </nav>
        <Link href="/login" className="marketing-login">Entrar</Link>
        <Link href="/signup" className="marketing-header-cta">Probar Marcha Solo <span aria-hidden="true">→</span></Link>
      </header>
      {children}
      <footer className="marketing-footer">
        <Link href="/para-que-sirve" aria-label="Marcha Solo, inicio"><Logo size={26} /></Link>
        <nav aria-label="Información">
          <Link href="/para-que-sirve">Qué puedes hacer</Link>
          <Link href="/como-empezar">Cómo empezar</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        <span>Automatiza lo repetitivo. Conserva las decisiones.</span>
      </footer>
    </div>
  )
}
