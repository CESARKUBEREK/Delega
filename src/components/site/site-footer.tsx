import Link from "next/link"
import { Logo } from "@/components/logo"
import { FooterAccountLinks } from "./account-hint"
import { CONTACT_EMAIL, SITE_LINKS, SOCIAL_LINKS } from "./nav-links"
import { LEGAL } from "@/lib/legal"

// Pie del sitio público: enlaces del producto (sin Precios ni Cómo funciona),
// contacto y redes.
// inApp: dentro de la app deja sitio para la barra inferior del celular.
export function SiteFooter({ inApp = false }: { inApp?: boolean }) {
  return (
    <footer className={inApp ? "site-footer is-app" : "site-footer"}>
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
            {SITE_LINKS.filter((l) => l.href !== "/precios" && l.href !== "/como-funciona").map((l) => (
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
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            {/* Solo las redes con dirección: sin enlace no se muestran. */}
            {SOCIAL_LINKS.some((s) => s.href) ? (
              <li>
                {SOCIAL_LINKS.filter((s) => s.href).map((s, i) => (
                  <span key={s.label}>
                    {i > 0 ? ", " : null}
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  </span>
                ))}
              </li>
            ) : null}
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
        <span>
          © 2026 MarchaSolo, un servicio de {LEGAL.owner} · SIREN {LEGAL.siren} · {LEGAL.address}, {LEGAL.country}
        </span>
        <FooterAccountLinks />
      </div>
    </footer>
  )
}
