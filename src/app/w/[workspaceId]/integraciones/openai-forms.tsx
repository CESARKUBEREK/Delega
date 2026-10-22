"use client"

import { useActionState, useRef } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { OPENAI_MODELS } from "@/lib/plan"
import { disconnectAi, saveAiKey, setAiModel, type AiKeyState } from "../ai-actions"

function ModelSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Modelo
      </label>
      <select
        id={id}
        name="model"
        defaultValue={defaultValue ?? OPENAI_MODELS[0].id}
        className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
      >
        {OPENAI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}: {m.hint}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ConnectKeyForm({ workspaceId, replacing, model }: { workspaceId: string; replacing: boolean; model?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<AiKeyState, FormData>(async (prev, formData) => {
    const result = await saveAiKey(prev, formData)
    // La clave no se queda en el formulario después de enviarla.
    formRef.current?.reset()
    return result
  }, {})

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="openai-key" className="text-sm font-medium text-ink">
          {replacing ? "Sustituir la clave" : "Clave de OpenAI"}
        </label>
        <input
          id="openai-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-…"
          required
          className="h-11 border border-rule bg-sheet px-3 font-mono text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        />
      </div>
      {replacing ? <input type="hidden" name="model" value={model} /> : <ModelSelect id="openai-model-new" />}
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Comprobando con OpenAI…">{replacing ? "Sustituir clave" : "Conectar"}</SubmitButton>
      </div>
    </form>
  )
}

export function ModelForm({ workspaceId, model }: { workspaceId: string; model: string }) {
  const [state, action] = useActionState<AiKeyState, FormData>(setAiModel, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <ModelSelect id="openai-model" defaultValue={model} />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar modelo</SubmitButton>
      </div>
    </form>
  )
}

export function DisconnectForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(disconnectAi, {})
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm("¿Desconectar OpenAI? La clave se borra y el asistente deja de funcionar en este espacio.")) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : "Desconectar y borrar la clave"}
      </button>
    </form>
  )
}
