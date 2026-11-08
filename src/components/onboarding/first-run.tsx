"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { continueRun, startRun } from "@/app/w/[workspaceId]/run-actions"

// «Listo» → «Probar ahora»: lanza la primera ejecución sin salir del
// onboarding y la sigue aquí mismo. Las acciones que escriben o envían se
// paran en «esperando tu aprobación», como siempre: aquí solo se avisa y se
// lleva a la pantalla de revisión (nunca se aprueba desde este paso).
type Phase =
  | { kind: "idle" }
  | { kind: "running"; runId: string }
  | { kind: "awaiting_approval"; runId: string }
  | { kind: "succeeded"; runId: string }
  | { kind: "failed"; runId: string | null; error: string }

const MAX_WAIT_MS = 4 * 60_000

export function FirstRun({
  workspaceId,
  base,
  flowId,
  primaryClass,
}: {
  workspaceId: string
  base: string
  flowId: string
  primaryClass: string
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Mientras la ejecución está en curso, pide al servidor que avance otro tramo.
  useEffect(() => {
    if (phase.kind !== "running" || !phase.runId) return
    const runId = phase.runId
    const started = Date.now()
    let stop = false
    ;(async () => {
      while (!stop && mounted.current) {
        const r = await continueRun(runId)
        if (stop || !mounted.current) return
        if (!r.ok) {
          setPhase({ kind: "failed", runId, error: r.error })
          return
        }
        if (r.status === "awaiting_approval") return setPhase({ kind: "awaiting_approval", runId })
        if (r.status === "succeeded") return setPhase({ kind: "succeeded", runId })
        if (r.status === "failed" || r.status === "cancelled") {
          return setPhase({ kind: "failed", runId, error: "La ejecución no terminó bien." })
        }
        // Sigue en curso: si tarda mucho, se sigue desde su página.
        if (Date.now() - started > MAX_WAIT_MS) return
        await new Promise((res) => setTimeout(res, r.busy ? 3000 : 1500))
      }
    })()
    return () => {
      stop = true
    }
  }, [phase])

  const start = async () => {
    setPhase({ kind: "running", runId: "" })
    const r = await startRun({ workspaceId, flowId, fileIds: [], note: "" }).catch(() => null)
    if (!mounted.current) return
    if (!r || !r.ok) {
      setPhase({ kind: "failed", runId: null, error: r?.error ?? "No se pudo empezar la ejecución." })
      return
    }
    if (r.status === "awaiting_approval") setPhase({ kind: "awaiting_approval", runId: r.runId })
    else if (r.status === "succeeded") setPhase({ kind: "succeeded", runId: r.runId })
    else if (r.status === "failed" || r.status === "cancelled") setPhase({ kind: "failed", runId: r.runId, error: "La ejecución no terminó bien." })
    else setPhase({ kind: "running", runId: r.runId })
  }

  const runLink = (runId: string, label: string) => (
    <Link href={`${base}/ejecuciones/${runId}`} className={primaryClass}>
      {label}
    </Link>
  )

  if (phase.kind === "idle") {
    return (
      <button type="button" onClick={start} className={primaryClass}>
        Probar ahora →
      </button>
    )
  }

  if (phase.kind === "running") {
    return (
      <div className="rounded-2xl border border-rule bg-paper p-4 flex flex-col gap-2" role="status" aria-live="polite">
        <p className="font-semibold text-ink">Trabajando en tu automatización…</p>
        <p className="text-sm text-graphite">Suele tardar menos de un minuto. Nada sale sin tu aprobación.</p>
        {phase.runId ? (
          <Link href={`${base}/ejecuciones/${phase.runId}`} className="text-sm font-semibold text-link underline underline-offset-4">
            Seguirla paso a paso
          </Link>
        ) : null}
      </div>
    )
  }

  if (phase.kind === "awaiting_approval") {
    return (
      <div className="rounded-2xl border border-ok bg-paper p-4 flex flex-col gap-3" role="status" aria-live="polite">
        <p className="font-semibold text-ink">Listo para que lo revises</p>
        <p className="text-sm text-graphite">
          He preparado el trabajo. Antes de enviar o guardar nada, revísalo y apruébalo tú.
        </p>
        {runLink(phase.runId, "Revisar y aprobar →")}
      </div>
    )
  }

  if (phase.kind === "succeeded") {
    return (
      <div className="rounded-2xl border border-ok bg-paper p-4 flex flex-col gap-3" role="status" aria-live="polite">
        <p className="font-semibold text-ink">¡Hecho!</p>
        <p className="text-sm text-graphite">Tu automatización ya funcionó una vez. Mira el resultado.</p>
        {runLink(phase.runId, "Ver el resultado →")}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-alert bg-paper p-4 flex flex-col gap-3" role="alert">
      <p className="font-semibold text-ink">No ha salido bien</p>
      <p className="text-sm text-graphite">{phase.error}</p>
      {phase.runId ? (
        runLink(phase.runId, "Ver por qué →")
      ) : (
        <button type="button" onClick={start} className={primaryClass}>
          Intentarlo otra vez →
        </button>
      )}
    </div>
  )
}
