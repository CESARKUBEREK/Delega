"use client"

import { useActionState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { MODE_HINT, MODE_LABEL, MODES, type WorkspaceRouting } from "@/lib/router"
import { type AiKeyState, setAiRouting } from "../ai-actions"

const usd = (v: number | null) => (v === null ? "" : String(v).replace(".", ","))

export function RoutingForm({ workspaceId, routing }: { workspaceId: string; routing: WorkspaceRouting }) {
  const [state, action] = useActionState<AiKeyState, FormData>(setAiRouting, {})
  return (
    <form action={action} className="flex flex-col gap-5 text-sm">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold text-ink">Modo</legend>
        {MODES.map((m) => (
          <label key={m} className="flex items-start gap-2">
            <input type="radio" name="mode" value={m} defaultChecked={routing.mode === m} className="mt-1" />
            <span>
              <span className="font-medium text-ink">
                {MODE_LABEL[m]}
                {m === "smart" ? " (recomendado)" : ""}
              </span>
              <span className="block text-graphite">{MODE_HINT[m]}</span>
            </span>
          </label>
        ))}
        <label className="mt-2 flex items-start gap-2">
          <input type="checkbox" name="cross_provider" defaultChecked={routing.crossProvider} className="mt-1" />
          <span>
            <span className="font-medium text-ink">Usar también mis otras IAs cuando convenga</span>
            <span className="block text-graphite">
              Si no, se usa siempre la IA principal y las demás solo de respaldo, cuando la principal falla o se queda sin saldo.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-ink">Presupuesto (USD, opcional)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="monthly-usd" name="monthly_usd" label="Al mes" defaultValue={usd(routing.monthlyUsd)} inputMode="decimal" />
          <Field id="daily-usd" name="daily_usd" label="Al día" defaultValue={usd(routing.dailyUsd)} inputMode="decimal" />
          <Field id="run-usd" name="run_usd" label="Por ejecución" defaultValue={usd(routing.runUsd)} inputMode="decimal" placeholder="Automático" />
        </div>
        <p className="text-graphite">
          Al 80 % te avisamos. Al llegar al límite, todo pasa al modo Ahorro y te avisamos. Una ejecución que llega a su presupuesto se pausa y te
          pregunta si continuar. «Automático» por ejecución: tres veces lo que suelen costar las de esa automatización.
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="stop_at_limit" defaultChecked={routing.stopAtLimit} className="mt-1" />
          <span>
            <span className="font-medium text-ink">Parar al llegar al límite</span>
            <span className="block text-graphite">En lugar de pasar a Ahorro, no se usa la IA hasta el día o el mes siguiente.</span>
          </span>
        </label>
      </fieldset>

      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
    </form>
  )
}

