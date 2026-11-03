import type { ProviderLink } from "@/lib/provider-links"

// Botón a la web de un proveedor, en otra pestaña (la de MarchaSolo sigue
// abierta para pegar la clave al volver).
export function ExternalLink({ link, compact = false }: { link: ProviderLink; compact?: boolean }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={compact ? "external-link is-compact" : "external-link"}
    >
      {link.label}
      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6" />
        <path d="M20 4 10 14" />
        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  )
}
