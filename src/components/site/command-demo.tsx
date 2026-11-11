import type { CSSProperties } from "react"

// La pieza central del sitio: una instrucción cotidiana se convierte en un
// proceso con varios pasos y aplicaciones conectadas. Es una ilustración;
// los botones no realizan acciones.
export type DemoStep = { title: string; detail: string; app: string }
export type Demo = {
  title: string
  ask: string
  steps: DemoStep[]
  approval: { title: string; text: string }
}

export const VISIT_DEMO: Demo = {
  title: "Seguimiento de nuevos clientes",
  ask: "Cada mañana revisa los nuevos contactos, consulta la información comercial y prepara el seguimiento.",
  steps: [
    { title: "Identifica nuevos contactos", detail: "Reúne las consultas recibidas en los canales conectados", app: "WhatsApp" },
    { title: "Consulta la información del cliente", detail: "Revisa antecedentes y oportunidades registradas", app: "CRM" },
    { title: "Busca información relevante", detail: "Recupera datos de productos o servicios", app: "Drive" },
    { title: "Prepara el seguimiento", detail: "Redacta un mensaje según el contexto", app: "Borrador" },
  ],
  approval: {
    title: "Revisar el mensaje de seguimiento",
    text: "El borrador queda listo para editar y autorizar antes del envío.",
  },
}

export function CommandDemo({ demo = VISIT_DEMO, animate = true, compact = false }: { demo?: Demo; animate?: boolean; compact?: boolean }) {
  const steps = compact ? demo.steps.slice(0, 3) : demo.steps
  const at = (i: number) => ({ "--d": `${0.25 + i * 0.55}s` }) as CSSProperties
  return (
    <figure className="console" data-animate={animate ? "" : undefined} aria-label={`Ejemplo: ${demo.title}`}>
      <div className="console-bar">
        <span className="console-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <b>{demo.title}</b>
        <span>MarchaSolo</span>
      </div>
      <div className="console-body">
        <div className="console-ask" style={at(0)}>
          <span className="console-ask-who" aria-hidden="true">Solicitud</span>
          <p>
            <span className="sr-only">Solicitud: </span>
            {demo.ask}
          </p>
        </div>
        <ol className="console-steps" aria-label="Lo que hace MarchaSolo">
          {steps.map((s, i) => (
            <li key={s.title} className="console-step" style={at(i + 1)}>
              <span className="console-tick" aria-hidden="true">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7.5l2.6 2.5L11 4.5" />
                </svg>
              </span>
              <span>
                <span className="console-step-title">{s.title}</span>
                <span className="console-step-detail">{s.detail}</span>
              </span>
              <span className="console-step-app">{s.app}</span>
            </li>
          ))}
        </ol>
        <div className="demo-approval" style={at(steps.length + 1)}>
          <div className="demo-approval-head">Pendiente de revisión</div>
          <p className="demo-approval-title">{demo.approval.title}</p>
          <p className="demo-approval-text">{demo.approval.text}</p>
          <div className="demo-approval-actions" aria-hidden="true">
            <span className="is-yes">Autorizar envío</span>
            <span className="is-edit">Editar</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
