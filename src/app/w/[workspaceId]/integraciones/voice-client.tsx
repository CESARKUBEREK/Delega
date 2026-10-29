"use client"

import { useActionState, useState, useTransition } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { DAY_NAMES, type VoiceConfig } from "@/lib/voice"
import { type ActionResult, createVoiceAccess, disconnectVoice, type KeyState, saveVoiceSettings } from "../run-actions"

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-graphite">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className={`min-w-0 flex-1 overflow-x-auto rounded-lg border border-rule bg-paper px-3 py-2 text-xs whitespace-nowrap text-ink ${secret ? "select-all" : ""}`}>
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              setCopied(false)
            }
          }}
          className="shrink-0 rounded-lg border border-ink px-3 text-sm font-medium text-ink hover:bg-paper"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}

// Crea (o vuelve a crear) la clave del servidor MCP. Se muestra una sola vez.
export function VoiceAccess({ workspaceId, url, connected }: { workspaceId: string; url: string; connected: boolean }) {
  const [busy, start] = useTransition()
  const [result, setResult] = useState<{ url: string; token: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function create() {
    if (connected && !window.confirm("¿Crear una clave nueva? La actual dejará de funcionar y tendrás que cambiarla en xAI.")) return
    setError(null)
    start(async () => {
      const r = await createVoiceAccess(workspaceId)
      if (r.ok) setResult({ url: r.url, token: r.token })
      else setError(r.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <CopyField label="URL del servidor MCP" value={result?.url ?? url} />
      {result ? (
        <>
          <CopyField label="Clave (cabecera Authorization)" value={`Bearer ${result.token}`} secret />
          <p role="status" className="border-l-2 border-ok bg-ok-bg px-3 py-2 text-sm text-ok">
            Copia la clave ahora: MarchaSolo la guarda cifrada y no volverá a mostrarla.
          </p>
        </>
      ) : null}
      {error ? <FormMessage error={error} /> : null}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className={
          connected
            ? "h-10 w-fit rounded-lg border border-ink px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
            : "h-11 w-fit rounded-lg bg-stroke px-5 text-sm font-semibold text-stroke-ink disabled:opacity-60"
        }
      >
        {busy ? "Creando…" : connected ? "Crear una clave nueva" : "Activar la atención telefónica"}
      </button>
    </div>
  )
}

export function VoiceSettingsForm({
  workspaceId,
  config,
  files,
}: {
  workspaceId: string
  config: VoiceConfig
  files: { id: string; name: string; kind: string }[]
}) {
  const [state, action] = useActionState<KeyState, FormData>(saveVoiceSettings, {})
  const range = (i: number) => config.ranges[i - 1] ?? { from: "", to: "" }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">Días con citas</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-lg border border-rule px-2.5 py-1.5 text-sm text-ink">
              <input type="checkbox" name="days" value={i + 1} defaultChecked={config.days.includes(i + 1)} />
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">Horario de citas</legend>
        {[1, 2].map((i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-ink">
            <span className="w-16 text-graphite">{i === 1 ? "Tramo 1" : "Tramo 2"}</span>
            <label className="sr-only" htmlFor={`voice-from${i}`}>Desde</label>
            <input id={`voice-from${i}`} name={`from${i}`} type="time" defaultValue={range(i).from} className="h-10 rounded-lg border border-rule bg-sheet px-2" />
            <span aria-hidden="true">–</span>
            <label className="sr-only" htmlFor={`voice-to${i}`}>Hasta</label>
            <input id={`voice-to${i}`} name={`to${i}`} type="time" defaultValue={range(i).to} className="h-10 rounded-lg border border-rule bg-sheet px-2" />
            {i === 2 ? <span className="text-xs text-graphite">Déjalo vacío si no hay tarde.</span> : null}
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          Duración de una cita
          <select name="duration" defaultValue={config.default_minutes} className="h-10 rounded-lg border border-rule bg-sheet px-2 font-normal">
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          Ofrecer horas cada
          <select name="slot" defaultValue={config.slot_minutes} className="h-10 rounded-lg border border-rule bg-sheet px-2 font-normal">
            {[15, 30, 60].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-semibold text-ink">Documentos que puede consultar (máximo 10)</legend>
        {files.length ? (
          files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="files" value={f.id} defaultChecked={config.file_ids.includes(f.id)} />
              {f.name} <span className="text-xs text-graphite">({f.kind})</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-graphite">Aún no hay archivos elegidos en Google Drive. Elígelos arriba, en Drives.</p>
        )}
        <p className="text-xs text-graphite">Solo lo que marques aquí. Elige fichas públicas: horarios, servicios, precios, preguntas frecuentes.</p>
      </fieldset>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton>
      </div>
    </form>
  )
}

export function VoicePlaybook({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <pre className="max-h-64 overflow-auto rounded-lg border border-rule bg-paper p-3 text-xs whitespace-pre-wrap text-ink">{text}</pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
        className="h-10 w-fit rounded-lg border border-ink px-4 text-sm font-medium text-ink hover:bg-paper"
      >
        {copied ? "Copiadas" : "Copiar las instrucciones"}
      </button>
    </div>
  )
}

export function DisconnectVoiceForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(disconnectVoice, null)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm("¿Desactivar la atención telefónica? El agente de xAI dejará de poder consultar la agenda y tomar recados.")) e.preventDefault()
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {state && !state.ok ? <FormMessage error={state.error} /> : null}
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desactivando…" : "Desactivar la atención telefónica"}
      </button>
    </form>
  )
}
