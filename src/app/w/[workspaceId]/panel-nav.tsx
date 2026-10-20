"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

const SECTIONS = [
  { slug: "", label: "Inicio" },
  { slug: "asistente", label: "Asistente" },
  { slug: "bandeja", label: "Bandeja" },
  { slug: "automatizaciones", label: "Automatizaciones" },
  { slug: "integraciones", label: "Integraciones" },
  { slug: "historial", label: "Historial" },
  { slug: "configuracion", label: "Configuración" },
]

export function PanelNav() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const pathname = usePathname()
  const base = `/w/${workspaceId}`

  return (
    <nav aria-label="Secciones del espacio">
      <ul className="flex gap-1 overflow-x-auto border border-ink bg-sheet lg:flex-col lg:gap-0 lg:divide-y lg:divide-rule">
        {SECTIONS.map(({ slug, label }) => {
          const href = slug ? `${base}/${slug}` : base
          const active = slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base
          return (
            <li key={slug} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block px-4 py-2.5 text-sm whitespace-nowrap ${
                  active ? "bg-ink font-semibold text-sheet" : "text-ink hover:bg-paper"
                }`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
