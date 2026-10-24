"use client"

import { useActionState, useRef } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { AI_PROVIDERS, type AiProvider } from "@/lib/plan"
import { type AiKeyState, disconnectAi, saveAiKey, setAiModel, setDefaultAi } from "../ai-actions"

const info = (provider: AiProvider) => AI_PROVIDERS.find((p) => p.id === provider)!

function ModelSelect({ id, provider, defaultValue }: { id: string; provider: AiProvider; defaultValue?: string }) {
  const models = info(provider).models
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Modelo
      </label>
      <select
        id={id}
        name="model"
        defaultValue={defaultValue ?? models[0].id}
        className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}: {m.hint}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ConnectKeyForm({
  workspaceId,
  provider,
  replacing,
  model,
}: {
  workspaceId: string
  provider: AiProvider
  replacing: boolean
  model?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<AiKeyState, FormData>(async (prev, formData) => {
    const result = await saveAiKey(prev, formData)
    // La clave no se queda en el formulario después de enviarla.
    formRef.current?.reset()
    return result
  }, {})
  const p = info(provider)

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${provider}-key`} className="text-sm font-medium text-ink">
          {replacing ? "Sustituir la clave" : `Clave de ${p.label}`}
        </label>
        <input
          id={`${provider}-key`}
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={`${p.keyPrefix}…`}
          required
          className="h-11 border border-rule bg-sheet px-3 font-mono text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        />
      </div>
      {replacing ? <input type="hidden" name="model" value={model} /> : <ModelSelect id={`${provider}-model-new`} provider={provider} />}
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel={`Comprobando con ${p.label}…`}>{replacing ? "Sustituir clave" : "Conectar"}</SubmitButton>
      </div>
    </form>
  )
}

export function ModelForm({ workspaceId, provider, model }: { workspaceId: string; provider: AiProvider; model: string }) {
  const [state, action] = useActionState<AiKeyState, FormData>(setAiModel, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <ModelSelect id={`${provider}-model`} provider={provider} defaultValue={model} />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar modelo</SubmitButton>
      </div>
    </form>
  )
}

export function DefaultForm({ workspaceId, provider }: { workspaceId: string; provider: AiProvider }) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(setDefaultAi, {})
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <FormMessage error={state.error} message={state.message} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-fit border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Usar como IA principal"}
      </button>
    </form>
  )
}

export function DisconnectForm({ workspaceId, provider }: { workspaceId: string; provider: AiProvider }) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(disconnectAi, {})
  const p = info(provider)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm(`¿Desconectar ${p.label}? La clave se borra; si era la IA principal, pasará a serlo otra de las conectadas.`)) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : "Desconectar y borrar la clave"}
      </button>
    </form>
  )
}
