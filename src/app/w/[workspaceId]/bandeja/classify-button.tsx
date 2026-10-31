"use client"

import { useActionState, useState, useTransition } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { classifyThreads, saveInboxSettings, type SettingsState, syncInbox } from "../run-actions"

// Vuelve a clasificar una conversación (la bandeja se clasifica sola cada
// minuto; ver supabase/functions/_shared/inbox-classify.ts).
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

// Trae el correo nuevo por tandas hasta terminar.
export function SyncButton({ workspaceId }: { workspaceId: string }) {
  const [busy, start] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  function run() {
    start(async () => {
      let total = 0
      for (let round = 0; round < 12; round++) {
        const result = await syncInbox(workspaceId)
        if (!result.ok) {
          setStatus(result.error)
          return
        }
        total += result.added
        const warn = result.warnings.length ? ` ${result.warnings.join(" ")}` : ""
        setStatus(`${total} correos nuevos${result.more ? ", sigue leyendo…" : "."}${warn}`)
        if (!result.more) return
      }
    })
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={status ?? undefined}
      className="h-10 border border-ink px-4 text-sm text-ink hover:bg-paper disabled:opacity-60"
    >
      {busy ? (status ?? "Leyendo el correo…") : status ? `Traer correo · ${status}` : "Traer correo"}
    </button>
  )
}

export function InboxSettingsForm({
  workspaceId,
  categories,
  retentionDays,
  draftsPerDay,
}: {
  workspaceId: string
  categories: string[]
  retentionDays: number | null
  draftsPerDay: number
}) {
  const [state, action] = useActionState<SettingsState, FormData>(saveInboxSettings, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inbox-categories" className="text-sm font-medium text-ink">
          Categorías para clasificar (una por línea)
        </label>
        <textarea
          id="inbox-categories"
          name="categories"
          rows={6}
          defaultValue={categories.join("\n")}
          className="border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-link focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inbox-retention" className="text-sm font-medium text-ink">
          Conservar mensajes (días)
        </label>
        <input
          id="inbox-retention"
          name="retentionDays"
          type="number"
          min={1}
          max={3650}
          defaultValue={retentionDays ?? ""}
          placeholder="Sin límite"
          className="h-11 w-40 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"
        />
        <p className="text-xs text-graphite">Los mensajes más antiguos se borran de MarchaSolo, no de tu buzón ni de Telegram.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="inbox-drafts" className="text-sm font-medium text-ink">
          Respuestas preparadas solas, como mucho al día
        </label>
        <input
          id="inbox-drafts"
          name="draftsPerDay"
          type="number"
          min={0}
          max={200}
          defaultValue={draftsPerDay}
          className="h-11 w-40 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"
        />
        <p className="text-xs text-graphite">
          Solo para lo urgente y para tus contactos; el resto se prepara al tocar «Preparar respuesta». Cada una gasta tu clave de IA. Con 0 no se preparan solas.
        </p>
      </div>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton>
      </div>
    </form>
  )
}
