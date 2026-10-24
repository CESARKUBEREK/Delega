"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useState } from "react"

const SECTIONS = [
  { slug: "", label: "Inicio" },
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
    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-stroke px-1.5 text-xs font-bold text-stroke-ink">
      <span className="sr-only">, pendientes: </span>
      {count > 99 ? "99+" : count}
    </span>
  )
}

// Navegación de escritorio (columna lateral).
export function PanelNav({ pending = 0 }: { pending?: number }) {
  const { base, isActive } = useSection()
  return (
    <nav aria-label="Secciones del espacio">
      <ul className="flex flex-col divide-y divide-rule border border-ink bg-sheet">
        {SECTIONS.map(({ slug, label }) => {
          const active = isActive(slug)
          return (
            <li key={slug}>
              <Link
                href={slug ? `${base}/${slug}` : base}
                aria-current={active ? "page" : undefined}
                className={`flex items-center px-4 py-2.5 text-sm whitespace-nowrap ${
                  active ? "bg-ink font-semibold text-sheet" : "text-ink hover:bg-paper"
                }`}
              >
                {label}
                {slug === "aprobaciones" ? <Badge count={pending} /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Iconos de la barra inferior (trazo de 1,8 px, heredan el color del texto).
const ICONS: Record<string, React.ReactNode> = {
  asistente: <path d="M4 5.5h16v10H9l-5 4v-14Z" />,
  aprobaciones: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.3 2.6 2.6 5-5.4" />
    </>
  ),
  bandeja: <path d="M3.5 13.5 6 5h12l2.5 8.5M3.5 13.5V19h17v-5.5M3.5 13.5H9a3 3 0 0 0 6 0h5.5" />,
  mas: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const TABS = [
  { slug: "asistente", label: "Chat" },
  { slug: "aprobaciones", label: "Aprobaciones" },
  { slug: "bandeja", label: "Bandeja" },
]
const MORE = SECTIONS.filter((s) => !TABS.some((t) => t.slug === s.slug))

// Barra inferior del móvil: Chat · Aprobaciones · Bandeja · Más.
export function MobileTabBar({ pending = 0 }: { pending?: number }) {
  const { base, isActive } = useSection()
  const [open, setOpen] = useState(false)
  const moreActive = MORE.some((s) => isActive(s.slug))

  return (
    <nav aria-label="Secciones del espacio" className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {open ? (
        <>
          <button type="button" aria-label="Cerrar el menú" className="fixed inset-0 -z-10 bg-ink/30" onClick={() => setOpen(false)} />
          <ul id="menu-mas" className="mx-3 mb-2 divide-y divide-rule border border-ink bg-sheet shadow-lg">
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
      <ul className="grid grid-cols-4 border-t border-ink bg-sheet pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ slug, label }) => {
          const active = isActive(slug)
          return (
            <li key={slug}>
              <Link
                href={`${base}/${slug}`}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-link" : "text-graphite"}`}
              >
                <Icon name={slug} />
                {label}
                {slug === "aprobaciones" && pending ? (
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
            className={`flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs ${moreActive || open ? "font-semibold text-link" : "text-graphite"}`}
          >
            <Icon name="mas" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}
