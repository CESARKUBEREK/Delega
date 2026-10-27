"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useState } from "react"

const SECTIONS = [
  { slug: "", label: "Hoy" },
  { slug: "asistente", label: "Asistente" },
  { slug: "aprobaciones", label: "Aprobaciones" },
  { slug: "bandeja", label: "Bandeja" },
  { slug: "automatizaciones", label: "Automatizaciones" },
  { slug: "integraciones", label: "Integraciones" },
  { slug: "historial", label: "Historial" },
  { slug: "configuracion", label: "Configuración" },
]

function useSection() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const pathname = usePathname()
  const base = `/w/${workspaceId}`
  const isActive = (slug: string) => {
    const href = slug ? `${base}/${slug}` : base
    return slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base
  }
  return { base, isActive }
}

function Badge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-stroke px-1.5 text-xs font-bold text-stroke-ink">
      <span className="sr-only">, pendientes: </span>
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function PanelNav({ pending = 0 }: { pending?: number }) {
  const { base, isActive } = useSection()
  return (
    <nav aria-label="Secciones del espacio" className="app-sidebar-nav">
      <p className="app-nav-heading">TU ESPACIO</p>
      <ul className="app-sidebar-list flex flex-col divide-y divide-rule border border-ink bg-sheet">
        {SECTIONS.map(({ slug, label }) => {
          const active = isActive(slug)
          return (
            <li key={slug}>
              <Link
                href={slug ? `${base}/${slug}` : base}
                aria-current={active ? "page" : undefined}
                className="app-sidebar-link"
              >
                <span className="app-nav-icon"><Icon name={slug || "hoy"} /></span>
                <span className="app-nav-label">{label}</span>
                {slug === "aprobaciones" || slug === "" ? <Badge count={pending} /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const ICONS: Record<string, React.ReactNode> = {
  hoy: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  asistente: <path d="M4 5.5h16v10H9l-5 4v-14Z" />,
  aprobaciones: <><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>,
  bandeja: <path d="M3.5 13.5 6 5h12l2.5 8.5M3.5 13.5V19h17v-5.5M3.5 13.5H9a3 3 0 0 0 6 0h5.5" />,
  automatizaciones: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h5a4 4 0 0 1 4 4v4a4 4 0 0 0 3 4M5 8v8a3 3 0 0 0 3 3h9" /></>,
  integraciones: <><path d="M8 7V3m8 4V3M7 7h10v4a5 5 0 0 1-10 0V7Z" /><path d="M12 16v5m-4 0h8" /></>,
  historial: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  configuracion: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></>,
  mas: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

// Móvil: lo que te necesita (Hoy, con las aprobaciones pendientes), pedir
// algo (Chat) y la bandeja. Aprobaciones y el resto quedan en «Más».
const TABS = [
  { slug: "", label: "Hoy" },
  { slug: "asistente", label: "Chat" },
  { slug: "bandeja", label: "Bandeja" },
]
const MORE = SECTIONS.filter((s) => !TABS.some((t) => t.slug === s.slug))

export function MobileTabBar({ pending = 0 }: { pending?: number }) {
  const { base, isActive } = useSection()
  const [open, setOpen] = useState(false)
  const moreActive = MORE.some((s) => isActive(s.slug))

  return (
    <nav aria-label="Secciones del espacio" className="mobile-tab-nav fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {open ? (
        <>
          <button type="button" aria-label="Cerrar el menú" className="fixed inset-0 -z-10 bg-ink/30" onClick={() => setOpen(false)} />
          <ul id="menu-mas" className="mobile-more-menu mx-3 mb-2 divide-y divide-rule border border-ink bg-sheet shadow-lg">
            {MORE.map(({ slug, label }) => (
              <li key={slug}>
                <Link
                  href={slug ? `${base}/${slug}` : base}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(slug) ? "page" : undefined}
                  className={`block px-4 py-3 ${isActive(slug) ? "font-semibold text-link" : "text-ink"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/w" onClick={() => setOpen(false)} className="block px-4 py-3 text-ink">
                Cambiar de espacio
              </Link>
            </li>
          </ul>
        </>
      ) : null}
      <ul className="mobile-tab-list grid grid-cols-4 border-t border-ink bg-sheet pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ slug, label }) => {
          const active = isActive(slug)
          return (
            <li key={slug}>
              <Link
                href={slug ? `${base}/${slug}` : base}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`app-mobile-tab-link relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-link" : "text-graphite"}`}
              >
                <Icon name={slug || "hoy"} />
                {label}
                {slug === "" && pending ? (
                  <span className="absolute top-1.5 left-1/2 ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-stroke px-1 text-[11px] font-bold text-stroke-ink">
                    <span className="sr-only">, pendientes: </span>
                    {pending > 99 ? "99+" : pending}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-mas"
            onClick={() => setOpen((o) => !o)}
            className={`app-mobile-tab-link flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs ${moreActive || open ? "font-semibold text-link" : "text-graphite"}`}
          >
            <Icon name="mas" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}
