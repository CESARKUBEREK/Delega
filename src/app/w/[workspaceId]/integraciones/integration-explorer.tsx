"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type CategoryOption = { id: string; label: string }
type ConnectionStatus = "connected" | "attention" | "setup" | "available"

const STATUS_FILTERS: { id: ConnectionStatus; label: string }[] = [
  { id: "connected", label: "Conectadas" },
  { id: "attention", label: "Requieren atención" },
  { id: "setup", label: "Requieren configuración" },
  { id: "available", label: "Disponibles" },
]

function isConnectionStatus(value: string): value is ConnectionStatus {
  return STATUS_FILTERS.some((filter) => filter.id === value)
}

export function IntegrationExplorer({
  categories,
  children,
}: {
  categories: CategoryOption[]
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState<ConnectionStatus | "all">("all")
  const [query, setQuery] = useState("")
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<ConnectionStatus, number>>({
    connected: 0,
    attention: 0,
    setup: 0,
    available: 0,
  })

  useEffect(() => {
    const container = root.current
    if (!container) return

    const applyFilters = () => {
      const loading = container.querySelector(".integration-loading") !== null
      const normalizedQuery = query.trim().toLocaleLowerCase("es")
      const cards = [...container.querySelectorAll<HTMLElement>("[data-integration-status]")]
      let visibleCount = 0
      const nextCounts: Record<ConnectionStatus, number> = {
        connected: 0,
        attention: 0,
        setup: 0,
        available: 0,
      }

      for (const card of cards) {
        const cardStatus = card.dataset.integrationStatus ?? ""
        if (isConnectionStatus(cardStatus)) nextCounts[cardStatus] += 1
        const summary = card.querySelector(".integration-summary")?.textContent?.toLocaleLowerCase("es") ?? ""
        const matchesCategory = category === "all" || card.closest(".integration-category")?.id === category
        const matchesStatus = status === "all" || cardStatus === status
        const matchesQuery = !normalizedQuery || summary.includes(normalizedQuery)
        card.hidden = !(matchesCategory && matchesStatus && matchesQuery)
        if (!card.hidden) visibleCount += 1
      }

      for (const section of container.querySelectorAll<HTMLElement>(".integration-category")) {
        const hasVisibleCards = [...section.querySelectorAll<HTMLElement>("[data-integration-status]")].some((card) => !card.hidden)
        section.hidden = !hasVisibleCards
      }

      const nextTotal = loading ? 0 : cards.length
      setTotal((current) => current === nextTotal ? current : nextTotal)
      const results = container.querySelector<HTMLElement>(".integration-results")
      if (results) results.dataset.empty = String(!loading && visibleCount === 0)
      setCounts((current) =>
        current.connected === nextCounts.connected &&
        current.attention === nextCounts.attention &&
        current.setup === nextCounts.setup &&
        current.available === nextCounts.available
          ? current
          : nextCounts
      )
    }

    applyFilters()
    const observer = new MutationObserver(applyFilters)
    observer.observe(container, { attributes: true, attributeFilter: ["data-integration-status"], characterData: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [category, query, status])

  return (
    <div className="integration-explorer" ref={root}>
      <section className="integration-overview" aria-labelledby="integration-overview-title">
        <div className="integration-overview-heading">
          <div>
            <p className="integration-overview-eyebrow">TUS CONEXIONES</p>
            <h2 id="integration-overview-title">Conecta tus aplicaciones para delegar</h2>
            <p>Revisa lo que ya está conectado o encuentra lo que necesitas para tu próxima tarea.</p>
          </div>
        </div>
        <div className="integration-status-filters" role="group" aria-label="Filtrar por estado de conexión">
          <button
            type="button"
            className="integration-status-filter"
            data-active={status === "all"}
            aria-pressed={status === "all"}
            onClick={() => setStatus("all")}
          >
            Todas <span>{total}</span>
          </button>
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="integration-status-filter"
              data-status={filter.id}
              data-active={status === filter.id}
              aria-pressed={status === filter.id}
              onClick={() => setStatus(filter.id)}
            >
              {filter.label} <span>{counts[filter.id]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="integration-catalog" aria-labelledby="integration-catalog-title">
        <div className="integration-catalog-heading">
          <div>
            <p className="integration-overview-eyebrow">CATÁLOGO DE SERVICIOS</p>
            <h2 id="integration-catalog-title">Elige qué conectar</h2>
          </div>
          <label className="integration-search">
            <span className="sr-only">Buscar integraciones</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.6" />
              <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o descripción"
            />
          </label>
        </div>
        <nav className="integration-category-nav" aria-label="Filtrar integraciones por categoría">
          <button
            type="button"
            className="integration-category-link"
            data-active={category === "all"}
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            Todas
          </button>
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              className="integration-category-link"
              data-active={category === item.id}
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="integration-results">
          {children}
          <p className="integration-empty-results" role="status">
            No encontramos aplicaciones que coincidan. Prueba otra búsqueda o categoría.
          </p>
        </div>
      </section>
    </div>
  )
}
