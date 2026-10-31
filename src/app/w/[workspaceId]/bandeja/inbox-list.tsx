"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { CHANNEL_LABEL } from "@/lib/inbox"
import { CategoryChip } from "./category-chip"
import { bulkUpdateThreads } from "./inbox-actions"

export type ListThread = {
  id: string
  channel: string
  subject: string | null
  who: string
  category: string | null
  category_source: string | null
  urgency: string | null
  needs_reply: boolean
  client: string | null
  project: string | null
  summary: string | null
  when: string
  pending: boolean
}

const URGENCY_STYLE: Record<string, string> = {
  alta: "border-alert text-alert",
  media: "border-rule text-ink",
  baja: "border-rule text-graphite",
}

// Lista de «Todo» (fase 6G-2): categoría arriba de cada fila y cambiable con un
// toque, selección múltiple y, en el móvil, deslizar a la derecha para archivar
// y a la izquierda para cambiar la categoría.
export function InboxList({
  workspaceId,
  base,
  threads,
  categories,
  archived,
}: {
  workspaceId: string
  base: string
  threads: ListThread[]
  categories: string[]
  archived: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, start] = useTransition()
  const touch = useRef<{ id: string; x: number; y: number } | null>(null)
  const [offset, setOffset] = useState<{ id: string; dx: number } | null>(null)

  const visible = threads.filter((t) => !hidden.has(t.id))
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function apply(ids: string[], change: { archived?: boolean; category?: string }) {
    setStatus(null)
    start(async () => {
      const r = await bulkUpdateThreads(workspaceId, ids, change)
      if (!r.ok) {
        setStatus(r.error)
        return
      }
      if (typeof change.archived === "boolean") setHidden((h) => new Set([...h, ...ids]))
      setSelected(new Set())
      setStatus(r.message ?? null)
    })
  }

  function onTouchEnd(id: string, e: React.TouchEvent) {
    const origin = touch.current
    touch.current = null
    setOffset(null)
    if (!origin || origin.id !== id) return
    const dx = e.changedTouches[0].clientX - origin.x
    const dy = e.changedTouches[0].clientY - origin.y
    if (Math.abs(dx) < 80 || Math.abs(dy) > 50) return
    if (dx > 0) apply([id], { archived: !archived })
    else setEditing(id)
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.size > 0 ? (
        <div className="inbox-bulk-bar" role="toolbar" aria-label="Acciones para las conversaciones elegidas">
          <span className="text-sm font-semibold text-ink">{selected.size} elegidas</span>
          <button type="button" onClick={() => apply([...selected], { archived: !archived })} disabled={busy}>
            {archived ? "Sacar del archivo" : "Archivar"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Cambiar categoría</span>
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) apply([...selected], { category: e.target.value })
                e.target.value = ""
              }}
            >
              <option value="">Cambiar categoría…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="is-quiet" onClick={() => setSelected(new Set())}>
            Cancelar
          </button>
        </div>
      ) : null}
      {status ? (
        <p className="text-sm text-graphite" role="status">
          {status}
        </p>
      ) : null}
      <p className="text-xs text-graphite sm:hidden">Desliza a la derecha para {archived ? "sacar del archivo" : "archivar"} y a la izquierda para cambiar la categoría.</p>

      <ul className="divide-y divide-rule border border-ink bg-sheet">
        {visible.map((t) => (
          <li
            key={t.id}
            className={`inbox-row ${selected.has(t.id) ? "is-selected" : ""}`}
            style={offset?.id === t.id ? { transform: `translateX(${Math.max(-90, Math.min(90, offset.dx))}px)` } : undefined}
            onTouchStart={(e) => {
              touch.current = { id: t.id, x: e.touches[0].clientX, y: e.touches[0].clientY }
            }}
            onTouchMove={(e) => {
              const s = touch.current
              if (s && s.id === t.id) setOffset({ id: t.id, dx: e.touches[0].clientX - s.x })
            }}
            onTouchEnd={(e) => onTouchEnd(t.id, e)}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={selected.has(t.id)}
                onChange={() => toggle(t.id)}
                aria-label={`Elegir la conversación con ${t.who}`}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                  {editing === t.id ? (
                    <CategoryChip workspaceId={workspaceId} threadId={t.id} category={t.category} categories={categories} source={t.category_source} compact />
                  ) : (
                    <button type="button" className="inbox-category-pill" onClick={() => setEditing(t.id)} aria-label={`Categoría: ${t.category ?? "sin categoría"}. Cambiar`}>
                      {t.category ?? (t.pending ? "Pendiente" : "Sin categoría")} ▾
                    </button>
                  )}
                  {t.urgency ? <span className={`border px-1.5 py-0.5 ${URGENCY_STYLE[t.urgency] ?? ""}`}>{t.urgency}</span> : null}
                  {t.needs_reply ? <span className="font-semibold text-link">Responder</span> : null}
                </div>
                <Link href={`${base}/${t.id}`} className="block hover:underline-offset-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">
                      <span className="mr-2 text-xs font-normal text-graphite">{CHANNEL_LABEL[t.channel]}</span>
                      {t.who}
                    </span>
                    <span className="text-xs text-graphite">{t.when}</span>
                  </div>
                  {t.subject ? <p className="mt-0.5 truncate text-sm text-ink">{t.subject}</p> : null}
                  {t.client || t.project ? (
                    <p className="text-xs text-graphite">
                      {t.client ? `Cliente: ${t.client}` : ""}
                      {t.project ? ` · ${t.project}` : ""}
                    </p>
                  ) : null}
                  {t.summary ? <p className="mt-1 line-clamp-2 text-sm text-graphite">{t.summary}</p> : null}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
