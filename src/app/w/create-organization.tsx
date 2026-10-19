"use client"

import { useActionState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { createOrganization, type WorkspaceFormState } from "./actions"

export function CreateOrganization() {
  const [state, action] = useActionState<WorkspaceFormState, FormData>(createOrganization, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="org-name" name="name" label="Nombre de la organización" placeholder="Estudio Martín Arquitectos" maxLength={120} required />
      <FormMessage error={state.error} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Creando…">Crear organización</SubmitButton>
      </div>
    </form>
  )
}
