"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Logo } from "@/components/logo"
import { useSignedInHint } from "./account-hint"
import { SITE_LINKS } from "./nav-links"

// Cabecera del sitio público: menú completo en escritorio y menú desplegable
// en móvil (se cierra con Escape, al navegar y al ensanchar la ventana).
export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const signedIn = useSignedInHint()
  const button = useRef<HTMLButtonElement>(null)

  // Cerrar el menú al cambiar de página.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        button.current?.focus()
      }
    }
    const wide = window.matchMedia("(min-width: 981px)")
    const onWide = () => wide.matches && setOpen(false)
    window.addEventListener("keydown", onKey)
    wide.addEventListener("change", onWide)
    return () => {
      window.removeEventListener("keydown", onKey)
      wide.removeEventListener("change", onWide)
    }
  }, [open])

  const current = (href: string) => (pathname === href ? "page" : undefined)

  return (
    <header className="site-header">
      <a href="#contenido" className="site-skip">
        Saltar al contenido
      </a>
      <div className="site-container site-header-row">
        <Link href="/" className="site-brand" aria-label="MarchaSolo, inicio">
          <Logo size={30} />
        </Link>
        <nav aria-label="Principal" className="site-nav">
          {SITE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          {signedIn ? (
            <Link href="/abrir" className="btn btn-primary btn-sm">
              Ir a mi espacio
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="site-login" aria-current={current("/entrar")}>
                Iniciar sesión
              </Link>
              <Link href="/crear-cuenta" className="btn btn-primary btn-sm">
                Crear cuenta gratis
              </Link>
            </>
          )}
          <button
            ref={button}
            type="button"
            className="site-menu-button"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="border-t border-[var(--ms-line)] bg-[var(--ms-white)]">
        <div className="site-container flex flex-wrap items-center justify-end gap-2 py-2 text-xs">
          <span className="mr-1 font-medium text-[var(--ms-graphite)]">Argentina · Derechos del consumidor</span>
          <Link href="/boton-de-arrepentimiento" className="btn btn-secondary btn-sm">Botón de arrepentimiento</Link>
          <Link href="/boton-de-baja" className="btn btn-secondary btn-sm">Botón de baja</Link>
        </div>
      </div>
      <div id="menu-movil" className="site-mobile-menu" data-open={open} hidden={!open}>
        <div className="site-container">
          <nav aria-label="Principal (móvil)">
            {SITE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="site-mobile-actions">
            {signedIn ? (
              <Link href="/abrir" className="btn btn-primary">
                Ir a mi espacio
              </Link>
            ) : (
              <>
                <Link href="/crear-cuenta" className="btn btn-primary">
                  Crear cuenta gratis
                </Link>
                <Link href="/entrar" className="btn btn-secondary">
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
