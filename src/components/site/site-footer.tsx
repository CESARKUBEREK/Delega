import Link from "next/link"
import { Logo } from "@/components/logo"
import { LEGAL } from "@/lib/legal"
import { SITE_LINKS } from "./nav-links"

// Pie del sitio público. Solo datos confirmados: el responsable y el correo
// de contacto son los de las páginas legales (src/lib/legal.ts).
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer-grid">
        <div>
          <Link href="/" aria-label="MarchaSolo, inicio" className="site-brand">
            <Logo size={30} />
          </Link>
          <p className="site-footer-claim">Tu negocio, en automático. Tú mantienes el control; MarchaSolo hace el trabajo.</p>
        </div>
        <div>
          <h2>Producto</h2>
          <ul>
            {SITE_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Empresa</h2>
          <ul>
            <li>
              <a href={`mailto:${LEGAL.email}`}>Contacto: {LEGAL.email}</a>
            </li>
            <li>
              {LEGAL.owner} ({LEGAL.country})
            </li>
          </ul>
        </div>
        <div>
          <h2>Legal</h2>
          <ul>
            <li>
              <Link href="/privacidad">Privacidad</Link>
            </li>
            <li>
              <Link href="/terminos">Términos</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-container site-footer-bottom">
        <span>© 2026 {LEGAL.owner}</span>
        <span className="flex gap-5">
          <Link href="/entrar">Entrar</Link>
          <Link href="/crear-cuenta">Crear cuenta</Link>
        </span>
      </div>
    </footer>
  )
}
