"use client"

import { useActionState, useState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { createInvitation, type WorkspaceFormState } from "../actions"

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<WorkspaceFormState, FormData>(createInvitation, {})
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <Field id="invite-email" name="email" type="email" label="Correo de la persona" autoComplete="off" required />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Rol</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="role" value="member" defaultChecked /> Miembro: crea y ejecuta flujos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="role" value="admin" /> Administrador: además gestiona miembros y conexiones
          </label>
        </fieldset>
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Creando invitación…">Crear invitación</SubmitButton>
      </form>

      {state.inviteLink ? (
        <div className="border-l-2 border-ok bg-ok-bg p-3 text-sm text-ok" role="status">
          <p>
            Invitación creada para {state.inviteEmail}. Envíale este enlace; caduca en 7 días y solo funciona una vez.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              aria-label="Enlace de invitación"
              value={state.inviteLink}
              className="h-9 min-w-0 flex-1 border border-rule bg-sheet px-2 text-xs text-ink"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="h-9 border border-ok px-3 text-ok"
              onClick={async () => {
                await navigator.clipboard.writeText(state.inviteLink!)
                setCopied(true)
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
