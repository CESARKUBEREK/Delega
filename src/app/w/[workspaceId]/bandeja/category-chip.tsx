"use client"

import { useState, useTransition } from "react"
import { createInboxRule, setThreadCategory } from "./inbox-actions"

// Categoría de una conversación, cambiable con un toque. Tras cambiarla ofrece
// «siempre para este remitente» o «para todo el dominio» (fase 6G-2).
export function CategoryChip({
  workspaceId,
  threadId,
  category,
  categories,
  source,
  compact = false,
}: {
  workspaceId: string
  threadId: string
  category: string | null
  categories: string[]
  source?: string | null
  compact?: boolean
}) {
  const [value, setValue] = useState(category ?? "")
  const [offer, setOffer] = useState<{ sender: string | null; domain: string | null; category: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, start] = useTransition()
  const options = category && !categories.includes(category) ? [...categories, category] : categories

  function change(next: string) {
    setValue(next)
    setNote(null)
    start(async () => {
      const r = await setThreadCategory(workspaceId, threadId, next)
      if (!r.ok) {
        setNote(r.error)
        setValue(category ?? "")
        return
      }
      setOffer(next && (r.sender || r.domain) ? { sender: r.sender, domain: r.domain, category: next } : null)
    })
  }

  function rule(matchType: "sender" | "domain", target: string) {
    if (!offer) return
    start(async () => {
      const r = await createInboxRule(workspaceId, matchType, target, offer.category)
      setOffer(null)
      setNote(r.ok ? (r.message ?? "Regla guardada.") : r.error)
    })
  }

  const sourceLabel = source === "rule" ? "por una regla" : source === "ai" ? "por la IA" : source === "user" ? "por ti" : null

  return (
    <div className={`inbox-category ${compact ? "is-compact" : ""}`}>
      <label className="inbox-category-select">
        <span className="sr-only">Categoría</span>
        <select value={value} onChange={(e) => change(e.target.value)} disabled={busy} aria-busy={busy}>
          <option value="">Sin categoría</option>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {!compact && sourceLabel ? <span className="text-xs text-graphite">Puesta {sourceLabel}</span> : null}
      {offer ? (
        <div className="inbox-rule-offer" role="status">
          <span>¿Siempre «{offer.category}»?</span>
          {offer.sender ? (
            <button type="button" onClick={() => rule("sender", offer.sender!)} disabled={busy}>
              Para {offer.sender}
            </button>
          ) : null}
          {offer.domain ? (
            <button type="button" onClick={() => rule("domain", offer.domain!)} disabled={busy}>
              Para todo @{offer.domain}
            </button>
          ) : null}
          <button type="button" className="is-quiet" onClick={() => setOffer(null)}>
            Solo esta
          </button>
        </div>
      ) : null}
      {note ? (
        <span className="text-xs text-graphite" role="status">
          {note}
        </span>
      ) : null}
    </div>
  )
}
