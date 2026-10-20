"use client"

import { useState, useTransition } from "react"
import { classifyThreads } from "../run-actions"

// Clasifica por tandas (8 conversaciones por petición) hasta terminar.
export function ClassifyButton({ workspaceId, pending, threadId }: { workspaceId: string; pending: number; threadId?: string }) {
  const [busy, start] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  function run() {
    start(async () => {
      let total = 0
      for (let round = 0; round < 25; round++) {
        const result = await classifyThreads(workspaceId, threadId)
        if (!result.ok) {
          setStatus(result.error)
          return
        }
        total += result.classified
        setStatus(`${total} clasificadas${result.remaining ? `, quedan ${result.remaining}…` : "."}`)
        if (threadId || result.remaining === 0 || result.classified === 0) return
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status ? (
        <span className="text-sm text-graphite" role="status">
          {status}
        </span>
      ) : null}
      <button
        type="button"
        onClick={run}
        disabled={busy || (!threadId && pending === 0)}
        className="h-10 bg-stroke px-4 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Clasificando…" : threadId ? "Volver a clasificar" : `Clasificar pendientes (${pending})`}
      </button>
    </div>
  )
}
