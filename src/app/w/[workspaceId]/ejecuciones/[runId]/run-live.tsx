"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { cancelRun, continueRun, decideRun } from "../../run-actions"

type Cell = string | number | boolean | null
export type Pending = {
  tool: "append_rows" | "update_range"
  fileName: string
  range: string
  values: Cell[][]
  before: Cell[][] | null
}

// Mientras la ejecución está "en curso", pide al servidor que avance otro
// tramo y refresca la página con la bitácora nueva.
export function RunControls({ runId, status }: { runId: string; status: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cancelling, startCancel] = useTransition()
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (status !== "running" || inFlight.current) return
    inFlight.current = true
    ;(async () => {
      const result = await continueRun(runId)
      inFlight.current = false
      if (!mounted.current) return
      router.refresh()
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.status === "running") {
        await new Promise((r) => setTimeout(r, 1500))
        if (mounted.current) setTick((t) => t + 1)
      }
    })()
  }, [runId, status, router, tick])

  return (
    <div className="flex flex-wrap items-center gap-4">
      {status === "running" ? (
        <p className="text-sm text-graphite" role="status">
          El agente está trabajando… La bitácora se actualiza sola.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={cancelling}
        onClick={() =>
          startCancel(async () => {
            await cancelRun(runId)
            router.refresh()
          })
        }
        className="text-sm text-alert underline underline-offset-4 disabled:opacity-60"
      >
        {cancelling ? "Cancelando…" : "Cancelar la ejecución"}
      </button>
    </div>
  )
}

function Table({ rows, caption }: { rows: Cell[][]; caption: string }) {
  const shown = rows.slice(0, 50)
  const width = Math.max(1, ...shown.map((r) => r.length))
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <caption className="mb-1 text-left text-xs font-medium text-graphite">{caption}</caption>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-t border-rule">
              {Array.from({ length: width }, (_, j) => (
                <td key={j} className="border-r border-rule px-2 py-1 align-top whitespace-nowrap text-ink last:border-r-0">
                  {row[j] === null || row[j] === undefined ? "" : String(row[j])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? <p className="mt-1 text-xs text-graphite">… y {rows.length - shown.length} filas más.</p> : null}
    </div>
  )
}

export function ApprovalCard({ runId, pending }: { runId: string; pending: Pending }) {
  const router = useRouter()
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function decide(approve: boolean) {
    setDecision(approve ? "approve" : "reject")
    setError(null)
    startTransition(async () => {
      const result = await decideRun(runId, approve)
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  return (
    <section className="border-2 border-stroke bg-sheet">
      <div className="border-b border-stroke px-5 py-3">
        <h2 className="font-semibold text-ink">Necesita tu aprobación</h2>
        <p className="text-sm text-graphite">
          {pending.tool === "append_rows"
            ? `Añadir ${pending.values.length} fila(s) al final de ${pending.range} en «${pending.fileName}».`
            : `Sobrescribir ${pending.range} en «${pending.fileName}».`}
        </p>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        {pending.before && pending.before.length > 0 ? <Table rows={pending.before} caption="Ahora" /> : null}
        <Table rows={pending.values} caption={pending.tool === "append_rows" ? "Filas nuevas" : "Quedará así"} />
        <p className="text-xs text-graphite">Se escribe el texto tal cual: nada se interpreta como fórmula.</p>
        {error ? (
          <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
          >
            {busy && decision === "approve" ? "Escribiendo…" : "Aprobar y escribir"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="h-11 border border-ink px-5 text-base font-medium text-ink hover:bg-paper disabled:opacity-60"
          >
            {busy && decision === "reject" ? "Rechazando…" : "Rechazar"}
          </button>
        </div>
      </div>
    </section>
  )
}
