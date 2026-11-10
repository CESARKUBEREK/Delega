"use client"

import { useActionState, useEffect } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { approveConsent, type ConsentState, denyConsent } from "./actions"

const field = "border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-link focus:outline-none"

export function ConsentForm({
  authorizationId,
  clientName,
  clientUri,
  email,
  workspaces,
  preferredWorkspace,
}: {
  authorizationId: string
  clientName: string
  clientUri: string | null
  email: string | null
  workspaces: { id: string; name: string }[]
  preferredWorkspace: string | null
}) {
  const [approved, approve] = useActionState<ConsentState, FormData>(approveConsent, {})
  const [denied, deny] = useActionState<ConsentState, FormData>(denyConsent, {})
  const redirectUrl = approved.redirectUrl ?? denied.redirectUrl

  // Vuelta al asistente (otro dominio): la hace el navegador.
  useEffect(() => {
    if (redirectUrl) window.location.assign(redirectUrl)
  }, [redirectUrl])

  if (redirectUrl) return <p className="text-sm text-ink">Volviendo a {clientName}…</p>

  if (!workspaces.length) {
    return (
      <div className="flex flex-col gap-3 text-sm text-ink">
        <p>
          <b>{clientName}</b> quiere conectarse con MarchaSolo, pero solo los owners y admins de un espacio pueden conectar asistentes.
        </p>
        <form action={deny}>
          <input type="hidden" name="authorizationId" value={authorizationId} />
          <SubmitButton pendingLabel="Cancelando…">Cancelar</SubmitButton>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm text-ink">
      <p>
        <b>{clientName}</b>
        {clientUri ? <span className="text-graphite"> ({new URL(clientUri).hostname})</span> : null} quiere acceder a tu MarchaSolo
        {email ? <> como <b>{email}</b></> : null}.
      </p>

      <form action={approve} className="flex flex-col gap-4">
        <input type="hidden" name="authorizationId" value={authorizationId} />
        <label className="flex flex-col gap-1">
          Espacio
          <select name="workspaceId" defaultValue={preferredWorkspace ?? workspaces[0].id} className={field}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Podrá:</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled /> Leer tu bandeja (correo, WhatsApp y Telegram)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="organize" /> Ordenarla: poner etiquetas y archivar
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="drafts" /> Dejarte borradores de respuesta
          </label>
        </fieldset>

        <p className="text-graphite">
          Nunca podrá enviar nada: cada borrador espera a que lo apruebes en MarchaSolo. Puedes revocar el acceso cuando quieras en
          Configuración → Asistentes conectados.
        </p>

        <FormMessage error={approved.error} />
        <SubmitButton pendingLabel="Conectando…">Permitir acceso</SubmitButton>
      </form>

      <form action={deny}>
        <input type="hidden" name="authorizationId" value={authorizationId} />
        <FormMessage error={denied.error} />
        <button type="submit" className="text-link underline underline-offset-4">
          No permitir
        </button>
      </form>
    </div>
  )
}
