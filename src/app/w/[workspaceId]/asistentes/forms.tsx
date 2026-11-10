"use client"

import { useActionState, useState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { createMcpKey, type KeyState, revokeMcpConnection, type RevokeState } from "./actions"

const field = "border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-link focus:outline-none"

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all border border-rule bg-sheet px-3 py-2 text-sm text-ink" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        className="text-sm text-link underline underline-offset-4"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}

export function CreateKeyForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<KeyState, FormData>(createMcpKey, {})
  if (state.apiKey) {
    return (
      <div className="flex flex-col gap-3 text-sm text-ink">
        <p>
          Clave de <b>{state.name}</b>. <b>Cópiala ahora: no se volverá a mostrar.</b> Ponla en tu asistente en la cabecera{" "}
          <code>Authorization: Bearer …</code>, nunca en la URL.
        </p>
        <CopyField value={state.apiKey} label="Clave de API" />
        <p className="text-graphite">El asistente puede ver esta clave y guardarla en su historial. Crea una por asistente para poder borrarla sin afectar a las demás.</p>
      </div>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-3 text-sm text-ink">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="flex flex-col gap-1">
        Nombre
        <input name="name" maxLength={80} placeholder="Grok Bot del Mac" className={field} required />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Podrá:</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked disabled /> Leer la bandeja
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="organize" /> Ordenarla (etiquetas y archivo)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="drafts" /> Dejar borradores de respuesta
        </label>
      </fieldset>
      <FormMessage error={state.error} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Creando…">Crear clave</SubmitButton>
      </div>
    </form>
  )
}

export function RevokeButton({ connectionId }: { connectionId: string }) {
  const [state, action] = useActionState<RevokeState, FormData>(revokeMcpConnection, {})
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="connectionId" value={connectionId} />
      <button type="submit" className="text-sm text-alert underline underline-offset-4">
        Revocar
      </button>
      {state.error ? <span className="text-xs text-alert">{state.error}</span> : null}
    </form>
  )
}
