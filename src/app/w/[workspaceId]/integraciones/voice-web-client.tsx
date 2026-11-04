"use client"

import { useActionState, useState, useSyncExternalStore, useTransition } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { CopyField } from "./voice-client"
import { createVoiceWeb, saveVoiceWeb, type VoiceWebState } from "./voice-web-actions"

export type VoiceWebWidget = {
  public_id: string
  enabled: boolean
  title: string
  sessions_per_day: number
  minutes_per_session: number
  allowed_domains: string[]
}

const field = "h-11 rounded-lg border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"

// Asistente de voz en la web del cliente: crear, ajustar y copiar el código.
export function VoiceWebPanel({ workspaceId, widget, xaiReady }: { workspaceId: string; widget: VoiceWebWidget | null; xaiReady: boolean }) {
  const [busy, start] = useTransition()
  const [note, setNote] = useState<VoiceWebState>({})
  // Dirección de esta app (para el código y el enlace de prueba), solo en el navegador.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  )
  const [state, action] = useActionState<VoiceWebState, FormData>(saveVoiceWeb, {})

  if (!widget) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => start(async () => setNote(await createVoiceWeb(workspaceId)))}
          className="h-11 w-fit rounded-lg bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Creando…" : "Crear el asistente para mi web"}
        </button>
        <FormMessage error={note.error} message={note.message} />
      </div>
    )
  }

  const snippet = `<script src="${origin}/widget-voz.js" data-id="${widget.public_id}" data-title="${widget.title.replace(/"/g, "&quot;")}" defer></script>`
  return (
    <div className="flex flex-col gap-4">
      {!xaiReady ? (
        <p className="integration-notice is-info border-l-2 px-3 py-2 text-sm">
          Conecta Grok (xAI) en LLMs, arriba: el asistente de la web habla con tu clave de xAI.
        </p>
      ) : null}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" name="enabled" defaultChecked={widget.enabled} className="h-4 w-4" /> Activo en mi web
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Texto del botón
          <input name="title" defaultValue={widget.title} maxLength={60} className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Conversaciones al día, como mucho
            <input name="sessionsPerDay" type="number" min={1} max={500} defaultValue={widget.sessions_per_day} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Minutos por conversación, como mucho
            <input name="minutesPerSession" type="number" min={1} max={30} defaultValue={widget.minutes_per_session} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Webs donde se puede usar (una o varias, sin https://)
          <input name="domains" defaultValue={widget.allowed_domains.join(", ")} placeholder="miclinica.com" className={field} />
        </label>
        <p className="text-xs text-graphite">
          Cada minuto de conversación se cobra en tu cuenta de xAI. Los límites evitan sorpresas: al llegar a las conversaciones del día, el botón
          invita a escribir o llamar.
        </p>
        <FormMessage error={state.error} message={state.message} />
        <div className="sm:max-w-48">
          <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
        </div>
      </form>

      <div className="flex flex-col gap-2 border-t border-rule pt-4">
        <p className="text-sm text-ink">Pega este código en tu web, antes de &lt;/body&gt;. Aparece un botón «{widget.title}» abajo a la derecha.</p>
        {origin ? <CopyField label="Código para tu web" value={snippet} /> : null}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {origin ? (
            <a href={`${origin}/hablar/${widget.public_id}`} target="_blank" rel="noreferrer" className="font-semibold text-link underline underline-offset-4">
              Probarlo ahora
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("¿Crear un código nuevo? El código que tengas en tu web dejará de funcionar.")) start(async () => setNote(await createVoiceWeb(workspaceId, true)))
            }}
            className="text-link underline underline-offset-4"
          >
            Cambiar el código
          </button>
        </div>
        <FormMessage error={note.error} message={note.message} />
      </div>
    </div>
  )
}
