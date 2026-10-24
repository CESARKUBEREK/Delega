"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useState, useTransition } from "react"
import { FormMessage } from "@/components/form"
import { AI_PROVIDERS } from "@/lib/plan"
import { type AiKeyState, setFlowModel } from "../../ai-actions"
import { setFlowActive, startRun } from "../../run-actions"

export function RunPanel({
  workspaceId,
  flowId,
  files,
  aiReady,
  needsFiles,
  isAdmin,
}: {
  workspaceId: string
  flowId: string
  files: { id: string; name: string; kind: string }[]
  aiReady: boolean
  needsFiles: boolean
  isAdmin: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(files.length === 1 ? [files[0].id] : [])
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const base = `/w/${workspaceId}`

  if (!aiReady) {
    return (
      <p className="text-sm text-graphite">
        Para ejecutar hace falta una IA conectada (OpenAI, Anthropic o DeepSeek).{" "}
        <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
          Ir a Integraciones
        </Link>
      </p>
    )
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s))
  }

  function run() {
    setError(null)
    startTransition(async () => {
      const result = await startRun({ workspaceId, flowId, fileIds: selected, note })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`${base}/ejecuciones/${result.runId}`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Archivos para esta ejecución (máximo 5)</legend>
        {files.length > 0 ? (
          files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
              {f.name} <span className="text-xs text-graphite">({f.kind})</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-graphite">
            No hay archivos elegidos en este espacio.{" "}
            {isAdmin ? (
              <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
                Conecta Google y elige archivos
              </Link>
            ) : (
              "Pide a un administrador que conecte Google y elija los archivos."
            )}
          </p>
        )}
        {needsFiles && files.length > 0 && selected.length === 0 ? (
          <p className="text-xs text-graphite">Este plan usa planillas o documentos: elige al menos uno.</p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="run-note" className="text-sm font-medium text-ink">
          Indicaciones para esta vez (opcional)
        </label>
        <textarea
          id="run-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Por ejemplo: usa la hoja «Octubre» y compárala con «Septiembre»."
          className="border border-rule bg-sheet px-3 py-2 text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending || (needsFiles && files.length > 0 && selected.length === 0)}
          className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Iniciando…" : "Ejecutar ahora"}
        </button>
        <span className="text-xs text-graphite">Lee sin preguntar; cada escritura espera tu aprobación.</span>
      </div>
    </div>
  )
}

// Flujos con disparador automático (un mensaje al bot de Telegram): se activan o pausan
// y se eligen los archivos que usará cada ejecución automática.
export function ActivationPanel({
  workspaceId,
  flowId,
  status,
  files,
  savedFileIds,
  telegramReady,
  canEdit,
}: {
  workspaceId: string
  flowId: string
  status: string
  files: { id: string; name: string; kind: string }[]
  savedFileIds: string[]
  telegramReady: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(savedFileIds.filter((id) => files.some((f) => f.id === id)))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const active = status === "active"

  function save(nextActive: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await setFlowActive({ workspaceId, flowId, active: nextActive, fileIds: selected })
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  if (!telegramReady) {
    return (
      <p className="text-sm text-graphite">
        Este flujo arranca al recibir un mensaje en Telegram. Primero conecta tu bot en{" "}
        <Link href={`/w/${workspaceId}/integraciones`} className="text-link underline underline-offset-4">
          Integraciones
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-graphite">
        {active
          ? "Activo: cada mensaje que reciba el bot del espacio lanzará una ejecución (máximo 30 por hora). Lo que quiera escribir o enviar esperará tu aprobación en Historial."
          : "Pausado: los mensajes que lleguen se registran, pero no lanzan este flujo."}
      </p>
      {files.length > 0 ? (
        <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
          <legend className="mb-1 text-sm font-medium text-ink">Archivos que usará (máximo 5)</legend>
          {files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() =>
                  setSelected((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : s.length < 5 ? [...s, f.id] : s))
                }
              />
              {f.name} <span className="text-xs text-graphite">({f.kind})</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : active ? "Guardar archivos" : "Activar"}
          </button>
          {active ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="h-11 border border-ink px-5 text-base font-medium text-ink hover:bg-paper disabled:opacity-60"
            >
              Pausar
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-graphite">Solo quien creó el flujo o un administrador puede activarlo.</p>
      )}
    </div>
  )
}

// Modelo de IA de esta automatización (o la IA principal del espacio).
export function FlowModelForm({
  workspaceId,
  flowId,
  model,
  providers,
  defaultLabel,
  canEdit,
}: {
  workspaceId: string
  flowId: string
  model: string
  providers: string[]
  defaultLabel: string
  canEdit: boolean
}) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(setFlowModel, {})
  const options = AI_PROVIDERS.filter((p) => providers.includes(p.id) || p.models.some((m) => m.id === model))
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="flowId" value={flowId} />
      <label htmlFor="flow-model" className="text-sm text-graphite">
        Qué IA ejecuta esta automatización. Si su proveedor deja de estar conectado, se usa la principal.
      </label>
      <select
        id="flow-model"
        name="model"
        defaultValue={model}
        disabled={!canEdit}
        className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none sm:max-w-md"
      >
        <option value="">IA principal del espacio{defaultLabel ? ` (${defaultLabel})` : ""}</option>
        {options.map((p) => (
          <optgroup key={p.id} label={p.label}>
            {p.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}: {m.hint}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <FormMessage error={state.error} message={state.message} />
      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="h-10 w-fit border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      ) : (
        <p className="text-xs text-graphite">Solo quien creó la automatización o un administrador puede cambiarlo.</p>
      )}
    </form>
  )
}
