"use client"

import { useActionState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { deleteWorkspace, leaveWorkspace, renameWorkspace, type ManageState } from "../actions"

export function RenameForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, action] = useActionState<ManageState, FormData>(renameWorkspace, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Field id="ws-name" name="name" label="Nombre" defaultValue={name} maxLength={120} required />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Guardando…">Guardar nombre</SubmitButton>
      </div>
    </form>
  )
}

export function DeleteForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, action] = useActionState<ManageState, FormData>(deleteWorkspace, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="expectedName" value={name} />
      <p className="text-sm text-graphite">
        Se borran la organización, sus miembros y sus invitaciones. No se puede deshacer. Escribe{" "}
        <span className="font-semibold text-ink">{name}</span> para confirmar.
      </p>
      <Field id="confirm-name" name="confirmName" label="Nombre de la organización" autoComplete="off" required />
      <FormMessage error={state.error} />
      <button
        type="submit"
        className="h-11 border border-alert px-4 font-semibold text-alert hover:bg-alert-bg sm:max-w-56"
      >
        Borrar organización
      </button>
    </form>
  )
}

export function LeaveForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<ManageState, FormData>(leaveWorkspace, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <p className="text-sm text-graphite">Dejarás de ver este espacio y lo que contiene. Para volver, necesitarás otra invitación.</p>
      <FormMessage error={state.error} />
      <button type="submit" className="h-11 border border-ink px-4 font-medium text-ink hover:bg-paper sm:max-w-56">
        Salir de la organización
      </button>
    </form>
  )
}
