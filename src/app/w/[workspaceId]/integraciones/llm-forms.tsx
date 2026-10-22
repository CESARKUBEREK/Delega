"use client"

import { useActionState, useRef } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/plan"
import { type AiKeyState, disconnectAi, saveAiKey, setAiModel, setDefaultAi } from "../ai-actions"

function Hidden({ workspaceId, provider }: { workspaceId: string; provider: LlmProvider }) {
  return (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
    </>
  )
}

function ModelSelect({ id, provider, defaultValue }: { id: string; provider: LlmProvider; defaultValue?: string }) {
  const models = LLM_PROVIDERS[provider].models
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
  provider: LlmProvider
  replacing: boolean
  model?: string
}) {
  const info = LLM_PROVIDERS[provider]
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<AiKeyState, FormData>(async (prev, formData) => {
    const result = await saveAiKey(prev, formData)
    // La clave no se queda en el formulario después de enviarla.
    formRef.current?.reset()
    return result
  }, {})

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Hidden workspaceId={workspaceId} provider={provider} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${provider}-key`} className="text-sm font-medium text-ink">
          {replacing ? "Sustituir la clave" : `Clave de ${info.label}`}
        </label>
        <input
          id={`${provider}-key`}
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={info.placeholder}
          required
          className="h-11 border border-rule bg-sheet px-3 font-mono text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        />
      </div>
      {replacing ? <input type="hidden" name="model" value={model} /> : <ModelSelect id={`${provider}-model-new`} provider={provider} />}
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel={`Comprobando con ${info.label}…`}>{replacing ? "Sustituir clave" : "Conectar"}</SubmitButton>
      </div>
    </form>
  )
}

export function ModelForm({ workspaceId, provider, model }: { workspaceId: string; provider: LlmProvider; model: string }) {
  const [state, action] = useActionState<AiKeyState, FormData>(setAiModel, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <Hidden workspaceId={workspaceId} provider={provider} />
      <ModelSelect id={`${provider}-model`} provider={provider} defaultValue={model} />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar modelo</SubmitButton>
      </div>
    </form>
  )
}

export function DefaultForm({ workspaceId, provider }: { workspaceId: string; provider: LlmProvider }) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(setDefaultAi, {})
  return (
    <form action={action} className="flex flex-col gap-2">
      <Hidden workspaceId={workspaceId} provider={provider} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-fit border border-ink px-4 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-60"
      >
        {pending ? "Cambiando…" : `Usar ${LLM_PROVIDERS[provider].label} en este espacio`}
      </button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  )
}

export function DisconnectForm({ workspaceId, provider, isDefault }: { workspaceId: string; provider: LlmProvider; isDefault: boolean }) {
  const label = LLM_PROVIDERS[provider].label
  const [state, action, pending] = useActionState<AiKeyState, FormData>(disconnectAi, {})
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        const extra = isDefault ? " Es el proveedor que usa el espacio: si hay otro conectado, pasará a usarse ese." : ""
        if (!window.confirm(`¿Desconectar ${label}? La clave se borra.${extra}`)) e.preventDefault()
      }}
    >
      <Hidden workspaceId={workspaceId} provider={provider} />
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : "Desconectar y borrar la clave"}
      </button>
    </form>
  )
}
