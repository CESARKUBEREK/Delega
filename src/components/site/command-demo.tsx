import type { CSSProperties } from "react"

// La pieza central del sitio: una petición en lenguaje natural se convierte en
// pasos que MarchaSolo hace solo (leer, consultar, redactar) y termina en lo
// que espera tu aprobación. Una sola animación al cargar; sin ella si se
// prefiere menos movimiento. Es una ilustración: los botones no hacen nada.
export type DemoStep = { title: string; detail: string; app: string }
export type Demo = {
  title: string
  ask: string
  steps: DemoStep[]
  approval: { title: string; text: string }
}

export const VISIT_DEMO: Demo = {
  title: "Responder consultas de visitas",
  ask: "Cuando un cliente pida ver un departamento, mira mi agenda y prepárale una respuesta con un horario libre.",
  steps: [
    { title: "Lee el correo de Laura Gómez", detail: "Quiere ver el departamento de Palermo esta semana", app: "Correo" },
    { title: "Mira tu agenda", detail: "Jueves libre de 10:00 a 12:00", app: "Calendar" },
    { title: "Busca la ficha del departamento", detail: "3 habitaciones, disponible", app: "CRM" },
    { title: "Redacta la respuesta", detail: "Propone el jueves a las 10:00", app: "Borrador" },
  ],
  approval: {
    title: "Enviar la respuesta a Laura Gómez",
    text: "«Hola, Laura: el jueves a las 10:00 puedo mostrarte el departamento de Palermo. ¿Te viene bien?»",
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
          <span className="console-ask-who" aria-hidden="true">Tú</span>
          <p>
            <span className="sr-only">Tú pides: </span>
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
          <div className="demo-approval-head">Espera tu aprobación</div>
          <p className="demo-approval-title">{demo.approval.title}</p>
          <p className="demo-approval-text">{demo.approval.text}</p>
          <div className="demo-approval-actions" aria-hidden="true">
            <span className="is-yes">Aprobar y enviar</span>
            <span className="is-edit">Editar</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
