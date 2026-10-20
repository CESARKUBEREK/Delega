"use client"

import { useActionState, useState, useTransition } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { retryWhatsAppSync, saveWhatsAppSettings, type SettingsState } from "../run-actions"

export function WhatsAppSettingsForm({
  workspaceId,
  categories,
  retentionDays,
}: {
  workspaceId: string
  categories: string[]
  retentionDays: number | null
}) {
  const [state, action] = useActionState<SettingsState, FormData>(saveWhatsAppSettings, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wa-categories" className="text-sm font-medium text-ink">
          Categorías para clasificar (una por línea)
        </label>
        <textarea
          id="wa-categories"
          name="categories"
          rows={5}
          defaultValue={categories.join("\n")}
          className="border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-stroke focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wa-retention" className="text-sm font-medium text-ink">
          Conservar mensajes (días)
        </label>
        <input
          id="wa-retention"
          name="retentionDays"
          type="number"
          min={1}
          max={3650}
          defaultValue={retentionDays ?? ""}
          placeholder="Sin límite"
          className="h-11 w-40 border border-rule bg-sheet px-3 text-sm text-ink focus:border-stroke focus:outline-none"
        />
        <p className="text-xs text-graphite">Los mensajes más antiguos se borran de Delega (no de tu móvil).</p>
      </div>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton>
      </div>
    </form>
  )
}

export function RetrySyncButton({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({})
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-2">
      <FormMessage error={state.error} message={state.message} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryWhatsAppSync(workspaceId)
            setState(r.ok ? { message: "Sincronización pedida a Meta." } : { error: r.error })
          })
        }
        className="w-fit text-sm text-stroke underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? "Pidiendo…" : "Volver a pedir contactos e histórico"}
      </button>
    </div>
  )
}
