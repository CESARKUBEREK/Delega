import { AVAILABLE_CONNECTIONS, CONNECTION_LABEL, STEP_LABEL, type FlowPlan } from "@/lib/plan"

// Plan de un flujo como hoja de pasos numerados. Solo muestra: no ejecuta.
export function PlanView({ plan, compact = false }: { plan: FlowPlan; compact?: boolean }) {
  return (
    <div className="border border-ink bg-sheet">
      <div className="border-b border-ink px-4 py-3">
        <p className="rotulo text-base text-ink">{plan.name}</p>
        {plan.summary ? <p className="mt-1 text-sm text-graphite">{plan.summary}</p> : null}
        <p className="mt-2 text-xs text-graphite">
          {plan.trigger.type === "schedule" ? "Programado" : "Manual"}
          {plan.trigger.description ? `: ${plan.trigger.description}` : ""}
        </p>
      </div>

      <ol className="divide-y divide-rule">
        {plan.steps.map((step, i) => (
          <li key={`${step.id}-${i}`} className="grid grid-cols-[2rem_1fr] gap-3 px-4 py-3">
            <span aria-hidden="true" className="rotulo pt-0.5 text-sm text-graphite">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-medium text-ink">
                <span className="sr-only">Paso {i + 1}: </span>
                {step.title}
              </p>
              {!compact && step.description ? <p className="mt-0.5 text-sm text-graphite">{step.description}</p> : null}
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-graphite">
                <span>{STEP_LABEL[step.kind] ?? step.kind}</span>
                {step.connection && step.connection !== "none" ? <span>{CONNECTION_LABEL[step.connection] ?? step.connection}</span> : null}
                {step.requires_approval ? <span className="font-medium text-ink">Requiere tu aprobación</span> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {plan.connections.length > 0 ? (
        <div className="border-t border-ink px-4 py-3">
          <p className="text-xs font-medium text-ink">Conexiones necesarias</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {plan.connections.map((c, i) => (
              <li key={i} className="text-graphite">
                <span className="text-ink">{CONNECTION_LABEL[c.kind] ?? c.kind}</span>
                {c.purpose ? `: ${c.purpose}` : ""}
                {AVAILABLE_CONNECTIONS.has(c.kind) ? null : <span className="text-xs"> (aún no disponible)</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.open_questions.length > 0 ? (
        <div className="border-t border-ink px-4 py-3">
          <p className="text-xs font-medium text-ink">Falta por concretar</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-graphite">
            {plan.open_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
