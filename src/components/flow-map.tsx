import Link from "next/link"
import { AVAILABLE_CONNECTIONS, CONNECTION_LABEL, STEP_LABEL, TRIGGER_LABEL, type FlowPlan, type FlowSchedule, type PlanStep } from "@/lib/plan"

// Mapa de una automatización: disparador → pasos, en columna en el móvil y en
// fila en escritorio. No se construye a mano: lo dibuja el plan que propuso el
// asistente. Cada bloque abre el editor de pasos cuando se puede editar.

const AI_KINDS = new Set(["generate", "transform", "compare", "condition"])
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

export function scheduleLabel(s: FlowSchedule): string {
  const time = s.time.replace(/^0(\d)/, "$1")
  switch (s.frequency) {
    case "daily":
      return `Cada día, ${time}`
    case "weekdays":
      return `Días laborables, ${time}`
    case "weekly":
      return `Cada ${WEEKDAYS[(s.weekday || 1) - 1]}, ${time}`
    case "monthly":
      return s.day_of_month === 0 ? `El último día del mes, ${time}` : `El día ${s.day_of_month} de cada mes, ${time}`
  }
}

type NodeKind = "trigger" | "ai" | "approval" | "plain"

function nodeKind(step: PlanStep): NodeKind {
  if (step.requires_approval) return "approval"
  if (AI_KINDS.has(step.kind)) return "ai"
  return "plain"
}

export function FlowMap({
  plan,
  schedule,
  editHref,
}: {
  plan: FlowPlan
  schedule?: FlowSchedule | null
  editHref?: string | null
}) {
  const triggerText =
    plan.trigger.type === "schedule" && schedule ? scheduleLabel(schedule) : TRIGGER_LABEL[plan.trigger.type] ?? "Manual"
  const triggerDetail = plan.trigger.description && plan.trigger.description !== triggerText ? plan.trigger.description : ""
  const missing = plan.connections.filter((c) => !AVAILABLE_CONNECTIONS.has(c.kind))

  return (
    <div className="flex flex-col gap-3">
      <figure className="flow-map m-0" aria-label={`Mapa de «${plan.name}»`}>
        <ol className="flow-map-track">
          <li className="flow-map-item">
            <Node kind="trigger" href={editHref} icon="clock" title={triggerText} meta={triggerDetail || "Cuándo empieza"} />
          </li>
          {plan.steps.map((step, i) => {
            const kind = nodeKind(step)
            const connection = step.connection && step.connection !== "none" ? CONNECTION_LABEL[step.connection] ?? step.connection : ""
            return (
              <li key={`${step.id}-${i}`} className="flow-map-item">
                <Node
                  kind={kind}
                  href={editHref}
                  number={i + 1}
                  icon={kind === "approval" ? "lock" : kind === "ai" ? "spark" : iconFor(step)}
                  title={step.title || STEP_LABEL[step.kind] || "Paso"}
                  meta={[STEP_LABEL[step.kind] ?? step.kind, connection].filter(Boolean).join(" · ")}
                  flag={kind === "approval" ? "Espera tu aprobación" : step.kind === "notify" ? "Sin aprobación" : null}
                />
              </li>
            )
          })}
        </ol>
        <figcaption className="flow-map-legend">
          <span>
            <i aria-hidden="true" style={{ background: "#17233e" }} />
            Cuándo empieza
          </span>
          <span>
            <i aria-hidden="true" style={{ border: "2px solid #2457d6" }} />
            Lo decide la IA
          </span>
          <span>
            <i aria-hidden="true" style={{ border: "1px dashed #c77d0a", background: "#fff6e5" }} />
            Espera tu aprobación
          </span>
        </figcaption>
      </figure>

      {missing.length > 0 ? (
        <p className="text-sm text-graphite">
          Aún no disponible: {missing.map((c) => CONNECTION_LABEL[c.kind] ?? c.kind).join(", ")}.
        </p>
      ) : null}
      {plan.open_questions.length > 0 ? (
        <div className="rounded-2xl border border-rule bg-sheet px-4 py-3">
          <p className="text-xs font-semibold text-ink">Falta por concretar</p>
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

function Node({
  kind,
  href,
  number,
  icon,
  title,
  meta,
  flag = null,
}: {
  kind: NodeKind
  href?: string | null
  number?: number
  icon: IconName
  title: string
  meta: string
  flag?: string | null
}) {
  const body = (
    <>
      {number ? (
        <span className="flow-node-number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
      ) : null}
      <span className="flow-node-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-col">
        {number ? <span className="sr-only">Paso {number}: </span> : <span className="sr-only">Disparador: </span>}
        <span className="flow-node-title">{title}</span>
        {meta ? <span className="flow-node-meta">{meta}</span> : null}
        {flag ? (
          <span className="flow-node-flag">
            {kind === "approval" ? null : <Icon name="bell" size={12} />}
            {flag}
          </span>
        ) : null}
      </span>
    </>
  )
  const className = `flow-node flow-node-${kind}`
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

type IconName = "clock" | "lock" | "spark" | "bell" | "mail" | "sheet" | "doc" | "calendar" | "chat" | "crm" | "folder" | "read"

function iconFor(step: PlanStep): IconName {
  if (step.kind === "notify") return "bell"
  switch (step.connection) {
    case "email":
      return "mail"
    case "spreadsheet":
      return "sheet"
    case "documents":
      return "doc"
    case "calendar":
      return "calendar"
    case "telegram":
    case "whatsapp":
      return "chat"
    case "crm":
    case "properties":
    case "accounting":
      return "crm"
    case "drive":
      return "folder"
    default:
      return "read"
  }
}

const PATHS: Record<IconName, React.ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4Z" />
      <path d="m19 15 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  sheet: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  crm: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 5.5" />
    </>
  ),
  folder: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />,
  read: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
