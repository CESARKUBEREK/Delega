"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { askHelpPanel } from "@/components/help-panel"
import { InfoBanner } from "@/components/ui"
import { startRun } from "../../run-actions"

// Botones de «Por qué falló»: volver a ejecutar la automatización y
// preguntarle al ayudante (que lee el error y la bitácora).
export function DiagnosisActions({
  workspaceId,
  flowId,
  fileIds,
  retry,
}: {
  workspaceId: string
  flowId: string | null
  fileIds: string[]
  retry: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const rerun = () => {
    if (!flowId) return
    setError(null)
    start(async () => {
      const r = await startRun({ workspaceId, flowId, fileIds, note: "" }).catch(() => null)
      if (!r) return setError("No se pudo lanzar. Inténtalo de nuevo.")
      if (!r.ok) return setError(r.error)
      if (r.runId) router.push(`/w/${workspaceId}/ejecuciones/${r.runId}`)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {flowId ? (
          <button
            type="button"
            onClick={rerun}
            disabled={pending}
            className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${retry ? "bg-stroke text-stroke-ink" : "border border-ink text-ink"}`}
          >
            {pending ? "Lanzando…" : "Volver a ejecutar"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => askHelpPanel("¿Por qué falló esta ejecución y cómo lo arreglo?")}
          className="inline-flex h-10 items-center rounded-xl border border-ink px-4 text-sm font-semibold text-ink"
        >
          Pregúntale al ayudante
        </button>
      </div>
      {error ? <InfoBanner tone="danger" role="alert">{error}</InfoBanner> : null}
    </div>
  )
}
