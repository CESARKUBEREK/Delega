"use client"

import { useActionState, useState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { DAY_NAMES, type HourRange } from "@/lib/voice"
import { type CalendarModeState, saveCalendarMode } from "./calendar-actions"

const field = "h-10 rounded-lg border border-rule bg-sheet px-2 text-sm text-ink focus:border-link focus:outline-none"

// Agenda inteligente: reservar citas con aprobación o directamente.
export function CalendarModeForm({
  workspaceId,
  flowId,
  mode,
  days,
  ranges,
  canEdit,
}: {
  workspaceId: string
  flowId: string
  mode: "approval" | "auto"
  days: number[]
  ranges: HourRange[]
  canEdit: boolean
}) {
  const [state, action] = useActionState<CalendarModeState, FormData>(saveCalendarMode, {})
  const [choice, setChoice] = useState(mode)
  const r = [ranges[0] ?? { from: "09:00", to: "14:00" }, ranges[1] ?? { from: "", to: "" }]

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="flowId" value={flowId} />
      <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
        <legend className="mb-1 text-sm font-semibold text-ink">Cuando haya que crear una cita</legend>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="radio" name="mode" value="approval" checked={choice === "approval"} onChange={() => setChoice("approval")} className="mt-1" />
          <span>
            <span className="font-medium">Pedir mi aprobación</span>
            <span className="block text-graphite">Ves la cita propuesta y decides. Recomendado al empezar.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="radio" name="mode" value="auto" checked={choice === "auto"} onChange={() => setChoice("auto")} className="mt-1" />
          <span>
            <span className="font-medium">Reservar directamente, sin consultarme</span>
            <span className="block text-graphite">
              Solo si la hora está libre en tu calendario y dentro del horario de abajo. Si no, te la propone para aprobar. Te avisamos de cada cita
              reservada.
            </span>
          </span>
        </label>
      </fieldset>

      {choice === "auto" ? (
        <fieldset className="flex flex-col gap-3 border-l-2 border-stroke pl-3" disabled={!canEdit}>
          <legend className="mb-1 text-sm font-semibold text-ink">Horario de citas</legend>
          <div className="flex flex-wrap gap-3">
            {DAY_NAMES.map((d, i) => (
              <label key={d} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" name="days" value={i + 1} defaultChecked={days.includes(i + 1)} /> {d}
              </label>
            ))}
          </div>
          {r.map((x, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span>{i === 0 ? "De" : "y de"}</span>
              <input type="time" name={`from${i}`} defaultValue={x.from} className={field} aria-label={`Desde (franja ${i + 1})`} />
              <span>a</span>
              <input type="time" name={`to${i}`} defaultValue={x.to} className={field} aria-label={`Hasta (franja ${i + 1})`} />
              {i === 1 ? <span className="text-xs text-graphite">(opcional)</span> : null}
            </div>
          ))}
          <p className="text-xs text-graphite">Como mucho 20 citas reservadas así cada 24 horas, con al menos 30 minutos de antelación y de hasta 4 horas.</p>
        </fieldset>
      ) : null}

      {canEdit ? (
        <>
          <FormMessage error={state.error} message={state.message} />
          <div className="sm:max-w-48">
            <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
          </div>
        </>
      ) : (
        <p className="text-xs text-graphite">Solo un administrador puede cambiarlo.</p>
      )}
    </form>
  )
}
