import { AVAILABLE_CONNECTIONS, CONNECTION_LABEL, STEP_LABEL, TRIGGER_LABEL, type FlowPlan } from "@/lib/plan"

// Plan de un flujo como hoja de pasos numerados. Solo muestra: no ejecuta.
export function PlanView({ plan, compact = false, animated = false }: { plan: FlowPlan; compact?: boolean; animated?: boolean }) {
  return (
    <div className={`plan-view border border-ink bg-sheet ${animated ? "plan-view-animated" : ""}`}>
      {animated ? (
        <div className="plan-team-stage border-b border-ink px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-graphite">TU EQUIPO DIGITAL</p>
              <p className="mt-1 text-sm font-semibold text-ink">Así colaborarán para resolverlo</p>
            </div>
            <span className="plan-live-indicator inline-flex items-center gap-2 rounded-full border border-stroke/30 bg-stroke/5 px-2.5 py-1 text-[10px] font-semibold text-ink">
              <span className="plan-live-dot h-1.5 w-1.5 rounded-full bg-stroke" /> EQUIPO PROPUESTO
            </span>
          </div>
          <div className="plan-team-flow mt-5" aria-label={`Equipo de ${plan.steps.length} funciones coordinadas`}>
            <div className="plan-team-spine" aria-hidden="true" />
            {plan.steps.map((step, i) => (
              <div className="plan-team-node" key={`team-${step.id}-${i}`} style={{ animationDelay: `${160 + i * 130}ms` }}>
                <span className="plan-team-node-icon" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="plan-team-node-copy">
                  <span className="plan-team-node-title">{step.title}</span>
                  <span className="plan-team-node-meta">{step.connection && step.connection !== "none" ? CONNECTION_LABEL[step.connection] ?? step.connection : STEP_LABEL[step.kind] ?? step.kind}</span>
                </span>
                <span className="plan-team-node-status" aria-hidden="true" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-graphite">Cada función tiene una tarea concreta. MarchaSolo coordina el conjunto y te pide aprobación cuando corresponde.</p>
        </div>
      ) : null}
      <div className="border-b border-ink px-4 py-3">
        <p className="rotulo text-base text-ink">{plan.name}</p>
        {plan.summary ? <p className="mt-1 text-sm text-graphite">{plan.summary}</p> : null}
        <p className="mt-2 text-xs text-graphite">
          {TRIGGER_LABEL[plan.trigger.type] ?? "Manual"}
          {plan.trigger.description ? `: ${plan.trigger.description}` : ""}
        </p>
      </div>

      <ol className="divide-y divide-rule">
        {plan.steps.map((step, i) => (
          <li key={`${step.id}-${i}`} className={`plan-step-row grid grid-cols-[2rem_1fr] gap-3 px-4 py-3 ${animated ? "plan-step-row-animated" : ""}`} style={animated ? { animationDelay: `${220 + i * 110}ms` } : undefined}>
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
