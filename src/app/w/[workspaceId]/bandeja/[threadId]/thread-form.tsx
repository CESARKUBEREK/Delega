"use client"

import { useActionState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { type SettingsState, updateThread } from "../../run-actions"

type ThreadValues = {
  id: string
  category: string | null
  client: string | null
  project: string | null
  urgency: string | null
  needsReply: boolean
  archived: boolean
}

const field = "h-10 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"

export function ThreadForm({ workspaceId, thread, categories }: { workspaceId: string; thread: ThreadValues; categories: string[] }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateThread, {})
  const options = thread.category && !categories.includes(thread.category) ? [...categories, thread.category] : categories
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="threadId" value={thread.id} />
      <label className="flex flex-col gap-1 text-sm text-ink">
        Categoría
        <select name="category" defaultValue={thread.category ?? ""} className={field}>
          <option value="">Sin categoría</option>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Cliente
        <input name="client" defaultValue={thread.client ?? ""} maxLength={120} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Obra o proyecto
        <input name="project" defaultValue={thread.project ?? ""} maxLength={120} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Urgencia
        <select name="urgency" defaultValue={thread.urgency ?? ""} className={field}>
          <option value="">Sin indicar</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="needsReply" defaultChecked={thread.needsReply} /> Necesita respuesta
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="archived" defaultChecked={thread.archived} /> Archivada
      </label>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
    </form>
  )
}
