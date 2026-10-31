"use client"

import { useState, useTransition } from "react"
import { dismissCard, muteFollowup, prepareReply } from "./inbox-actions"

// Botones de una tarjeta de «Para hoy» (fase 6G-3 y 6G-4).
export function CardActions({
  workspaceId,
  threadId,
  mode,
  prepareLabel,
  canPrepare,
}: {
  workspaceId: string
  threadId: string
  mode: "reply" | "followup"
  prepareLabel: string
  canPrepare: boolean
}) {
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error ?? "No se pudo hacer.")
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="today-card-actions">
        {canPrepare ? (
          <button type="button" className="is-primary" disabled={busy} onClick={() => run(() => prepareReply(workspaceId, threadId, mode))}>
            {busy ? "Preparando…" : prepareLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          aria-label={mode === "followup" ? "No recordar esta conversación" : "Descartar la tarjeta"}
          onClick={() => run(() => (mode === "followup" ? muteFollowup(workspaceId, threadId) : dismissCard(workspaceId, threadId)))}
        >
          {mode === "followup" ? "No recordar" : "Descartar"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
