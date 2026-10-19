"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { startRun } from "../../run-actions"

export function RunPanel({
  workspaceId,
  flowId,
  files,
  aiReady,
  needsSheets,
  isAdmin,
}: {
  workspaceId: string
  flowId: string
  files: { id: string; name: string }[]
  aiReady: boolean
  needsSheets: boolean
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
        Para ejecutar hace falta una clave de OpenAI activa.{" "}
        <Link href={`${base}/integraciones`} className="text-stroke underline underline-offset-4">
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
        <legend className="mb-1 text-sm font-medium text-ink">Planillas para esta ejecución (máximo 5)</legend>
        {files.length > 0 ? (
          files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
              {f.name}
            </label>
          ))
        ) : (
          <p className="text-sm text-graphite">
            No hay planillas elegidas en este espacio.{" "}
            {isAdmin ? (
              <Link href={`${base}/integraciones`} className="text-stroke underline underline-offset-4">
                Conecta Google y elige planillas
              </Link>
            ) : (
              "Pide a un administrador que conecte Google y elija las planillas."
            )}
          </p>
        )}
        {needsSheets && files.length > 0 && selected.length === 0 ? (
          <p className="text-xs text-graphite">Este plan usa planillas: elige al menos una.</p>
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
          className="border border-rule bg-sheet px-3 py-2 text-sm text-ink placeholder:text-graphite/70 focus:border-stroke focus:outline-none"
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
          disabled={pending || (needsSheets && selected.length === 0)}
          className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Iniciando…" : "Ejecutar ahora"}
        </button>
        <span className="text-xs text-graphite">Lee sin preguntar; cada escritura espera tu aprobación.</span>
      </div>
    </div>
  )
}
