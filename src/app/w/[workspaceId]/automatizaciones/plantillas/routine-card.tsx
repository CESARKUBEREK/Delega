import Link from "next/link"
import { TRIGGER_LABEL } from "@/lib/plan"
import { findTemplate, type FlowTemplate, NEED_LABEL, type Routine, type TemplateNeed } from "@/lib/templates"
import { createFlowFromTemplate } from "../../ai-actions"

// Ficha de una rutina y fila de una plantilla (página de Rutinas).
function Needs({ needs, ready }: { needs: TemplateNeed[]; ready: Set<TemplateNeed> }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Aplicaciones que necesita">
      {needs.map((n) => (
        <li key={n} className={`routine-need ${ready.has(n) ? "is-ready" : ""}`}>
          {ready.has(n) ? "✓ " : ""}
          {NEED_LABEL[n]}
          <span className="sr-only">{ready.has(n) ? " (conectado)" : " (sin conectar)"}</span>
        </li>
      ))}
    </ul>
  )
}

export function RoutineCard({ routine: r, ready, base, workspaceId }: { routine: Routine; ready: Set<TemplateNeed>; base: string; workspaceId: string }) {
  const templates = r.templates.map(findTemplate).filter((t): t is FlowTemplate => Boolean(t))
  return (
    <article id={`rutina-${r.id}`} className="routine-card scroll-mt-24">
      <header className="flex items-start gap-3">
        <span className="routine-number" aria-hidden="true">
          {String(r.number).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink">{r.title}</h3>
          <p className="text-sm text-graphite">{r.problem}</p>
        </div>
      </header>

      <dl className="routine-facts">
        <div>
          <dt>Consulta</dt>
          <dd>{r.reads}</dd>
        </div>
        <div>
          <dt>Hace sola</dt>
          <dd>{r.auto}</dd>
        </div>
        <div>
          <dt>Pide tu aprobación</dt>
          <dd>{r.approval}</dd>
        </div>
        <div>
          <dt>Te ahorra</dt>
          <dd>{r.saves}</dd>
        </div>
      </dl>

      <Needs needs={r.needs} ready={ready} />

      {r.link ? (
        <Link href={`${base}/${r.link.path}`} className="routine-link">
          {r.link.label} →
        </Link>
      ) : null}

      {templates.length ? (
        <details className="routine-templates" open={!r.link && templates.length === 1}>
          <summary>{templates.length === 1 ? "Plantilla" : `Ver las ${templates.length} plantillas`}</summary>
          <ul className="flex flex-col gap-3">
            {templates.map((t, i) => (
              <li key={t.id}>
                <TemplateRow template={t} ready={ready} workspaceId={workspaceId} base={base} primary={i === 0} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  )
}

export function TemplateRow({
  template: t,
  ready,
  workspaceId,
  base,
  primary = false,
}: {
  template: FlowTemplate
  ready: Set<TemplateNeed>
  workspaceId: string
  base: string
  primary?: boolean
}) {
  const missing = t.needs.filter((n) => !ready.has(n))
  return (
    <div className={`routine-template ${primary ? "is-primary" : ""}`}>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-ink">
          {t.plan.name}
          {primary ? <span className="routine-main">Recomendada</span> : null}
        </p>
        <p className="text-sm text-graphite">{t.plan.summary}</p>
        <p className="text-xs text-graphite">
          <span className="font-semibold text-ink">Arranca: </span>
          {t.plan.trigger.type === "schedule" ? t.plan.trigger.description : (TRIGGER_LABEL[t.plan.trigger.type] ?? t.plan.trigger.type)}
          {" · "}
          {t.setup}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={createFlowFromTemplate}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="templateId" value={t.id} />
          <button type="submit" className="h-10 rounded-lg bg-stroke px-4 text-sm font-semibold text-stroke-ink hover:opacity-90">
            Usar esta plantilla
          </button>
        </form>
        {missing.length ? (
          <Link href={`${base}/integraciones`} className="text-sm text-link underline underline-offset-4">
            Falta conectar: {missing.map((n) => NEED_LABEL[n]).join(", ")}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
