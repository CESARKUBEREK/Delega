import Link from "next/link"
import type { ReactNode } from "react"
import { Logo, LogoMark } from "./logo"

// La lámina: el formulario se presenta como una hoja de plano, con una cota
// encima y el cajetín (recuadro de datos del plano) al pie.
export function Sheet({
  title,
  sheetName,
  children,
  footer,
}: {
  title: string
  sheetName: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Qué puedes hacer con Marcha Solo">
        <header className="auth-brand"><Logo size={38} id="orkesta-auth" /></header>
        <div className="auth-copy">
          <span className="auth-eyebrow"><span className="auth-live-dot" /> AUTOMATIZACIÓN CON IA</span>
          <h2>Las tareas avanzan.<br /><span>Tú decides.</span></h2>
          <p>Conecta tus herramientas, describe lo que necesitas y deja que Marcha Solo prepare el trabajo.</p>
        </div>
        <div className="workflow-card" aria-label="Ejemplo de automatización: correo, Marcha Solo y aprobación">
          <div className="workflow-top"><span>FLUJO DE TRABAJO</span><span className="workflow-status"><i /> LISTO PARA REVISAR</span></div>
          <div className="workflow-lane">
            <div className="workflow-node"><span className="workflow-icon inbox-icon">✉</span><span><b>Nuevo correo</b><small>Solicitud recibida</small></span></div>
            <span className="workflow-link" aria-hidden="true"><i /></span>
            <div className="workflow-node brand-node"><span className="workflow-icon brand-icon"><LogoMark size={22} id="orkesta-flow" /></span><span><b>Marcha Solo prepara</b><small>Clasifica y propone</small></span></div>
            <span className="workflow-link" aria-hidden="true"><i /></span>
            <div className="workflow-node"><span className="workflow-icon check-icon">✓</span><span><b>Tu aprobación</b><small>Antes de ejecutar</small></span></div>
          </div>
          <div className="workflow-bottom"><span className="workflow-check">✓</span> Tú mantienes el control de cada acción</div>
        </div>
        <div className="auth-footnote"><span>01</span> Automatiza lo repetitivo. Conserva las decisiones.</div>
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      </section>

      <section className="auth-form-side">
        <div className="auth-form-brand"><Logo size={34} tagline id="orkesta-auth-mobile" /></div>
        <div className="auth-form-card">
          <nav className="auth-info-links" aria-label="Conoce Marcha Solo">
            <Link href="/para-que-sirve">Qué puedes hacer</Link>
            <Link href="/como-empezar">Cómo empezar</Link>
          </nav>
          <div className="auth-form-kicker">{sheetName.toUpperCase()}</div>
          <h1 className="rotulo text-[1.8rem] text-ink">{title}</h1>
          <div className="auth-form-content">{children}</div>
          <div className="auth-form-footer">{footer}</div>
        </div>
        <p className="auth-privacy"><span>⌑</span> Tus datos y tus conexiones permanecen bajo tu control.</p>
      </section>
    </main>
  )
}

