"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { InfoBanner } from "@/components/ui"
import { setHelpVoice } from "../help-actions"

export function HelpVoiceToggle({ workspaceId, enabled, disabled }: { workspaceId: string; enabled: boolean; disabled: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await setHelpVoice(workspaceId, !enabled).catch(() => null)
            if (!r || !r.ok) setError(r && !r.ok ? r.error : "No se pudo guardar.")
            else router.refresh()
          })
        }
        className={`inline-flex h-10 items-center self-start px-4 text-sm font-semibold disabled:opacity-50 ${enabled ? "border border-ink text-ink" : "bg-stroke text-stroke-ink"}`}
      >
        {pending ? "Guardando…" : enabled ? "Desactivar la conversación por voz" : "Activar la conversación por voz"}
      </button>
      {error ? <InfoBanner tone="danger" role="alert">{error}</InfoBanner> : null}
    </div>
  )
}
