import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"

export const metadata: Metadata = {
  title: "Qué puedes hacer",
  description: "Descubre cómo Marcha Solo convierte tareas repetitivas en flujos de trabajo que puedes revisar, ajustar y poner en marcha.",
  robots: { index: true, follow: true },
}

const examples = [
  {
    number: "01",
    title: "Pon orden en los mensajes",
    body: "Reúne correo, WhatsApp y Telegram en una bandeja. Clasifica conversaciones, encuentra lo urgente y prepara respuestas para que las revises.",
    tag: "MENSAJES",
  },
  {
    number: "02",
    title: "Pasa de la petición a un plan",
    body: "Describe una tarea como se la explicarías a una persona de tu equipo. El asistente propone los pasos y tú puedes ajustarlos antes de guardarlos.",
    tag: "ASISTENTE",
  },
  {
    number: "03",
    title: "Mantén los datos al día",
    body: "Conecta tus documentos, planillas, agenda y CRM para preparar actualizaciones y tareas usando las herramientas que ya forman parte de tu trabajo.",
    tag: "HERRAMIENTAS",
  },
]

export default function WhatIsMarchaSoloPage() {
  return (
    <MarketingLayout>
      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-eyebrow"><span /> TU NEGOCIO, CON MÁS IMPULSO</p>
            <h1>Menos tareas que se repiten.<br /><em>Más tiempo para avanzar.</em></h1>
            <p className="marketing-lead">
              Marcha Solo convierte instrucciones cotidianas en planes de trabajo que puedes revisar, adaptar y poner en marcha.
              Conecta tus herramientas y deja que la IA te ayude con el trabajo repetitivo.
            </p>
            <div className="marketing-actions">
              <Link href="/signup" className="marketing-primary-button">Prueba Marcha Solo <span aria-hidden="true">→</span></Link>
              <Link href="/como-empezar" className="marketing-text-link">Descubre cómo funciona <span aria-hidden="true">↗</span></Link>
            </div>
            <p className="marketing-reassurance">Tú marcas el objetivo. Tú revisas el plan. Tú decides cómo avanzar.</p>
          </div>
          <div className="marketing-hero-visual" aria-label="Ejemplo de tarea preparada para revisión">
            <div className="marketing-glow" />
            <div className="marketing-task-card">
              <div className="marketing-task-top"><span className="marketing-task-icon">✉</span><span><small>NUEVA TAREA</small><b>Consulta de presupuesto</b></span><i>PARA REVISAR</i></div>
              <p>“Ayúdame a responder esta consulta y organiza los datos del cliente.”</p>
              <div className="marketing-task-steps">
                <div><span>1</span><p><b>Entender</b><small>Leer y resumir el mensaje</small></p><strong>✓</strong></div>
                <div><span>2</span><p><b>Preparar</b><small>Redactar una respuesta</small></p><strong>✓</strong></div>
                <div><span>3</span><p><b>Revisar</b><small>Decides antes de enviar</small></p><strong>↗</strong></div>
              </div>
              <div className="marketing-task-foot"><span /> Plan listo para que lo revises</div>
            </div>
            <div className="marketing-float-card"><span>✦</span> La decisión sigue siendo tuya</div>
          </div>
        </section>

        <section className="marketing-section marketing-capabilities">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">UNA AYUDA PRÁCTICA, CADA DÍA</p>
            <h2>Tu forma de trabajar,<br /><em>con menos pasos manuales.</em></h2>
          </div>
          <div className="marketing-example-grid">
            {examples.map((item) => (
              <article className="marketing-example-card" key={item.number}>
                <span className="marketing-card-number">{item.number}</span>
                <span className="marketing-card-tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-use-cases">
          <div>
            <p className="marketing-eyebrow">EMPIEZA CON ALGO CONCRETO</p>
            <h2>Una tarea menos en tu lista<br /><em>ya es un buen comienzo.</em></h2>
            <p>Prueba con una de las rutinas que conoces de memoria:</p>
          </div>
          <ul className="marketing-prompt-list">
            <li><span>“</span>Cuando llegue una consulta, clasifícala y déjame una respuesta preparada.</li>
            <li><span>“</span>Antes de la reunión, reúne la información del cliente y prepara un resumen.</li>
            <li><span>“</span>Cada viernes, organiza los datos de la semana y prepara un informe para revisar.</li>
          </ul>
        </section>

        <section className="marketing-integrations-band">
          <div>
            <p className="marketing-eyebrow">TUS HERRAMIENTAS, EN CONJUNTO</p>
            <h2>Conecta lo que ya usas.</h2>
            <p>Trabaja con tus archivos, mensajes, agenda y registros de clientes desde un mismo espacio. Empieza por las conexiones que necesitas y añade otras cuando quieras.</p>
          </div>
          <div className="marketing-integration-pills" aria-label="Algunas herramientas disponibles">
            <span>Google Drive</span><span>Google Calendar</span><span>Gmail</span><span>WhatsApp</span><span>Telegram</span><span>HubSpot</span>
          </div>
        </section>

        <section className="marketing-final-cta">
          <p className="marketing-eyebrow">DA EL PRIMER PASO</p>
          <h2>Cuéntale una tarea.<br /><em>Empieza a recuperar tiempo.</em></h2>
          <p>Describe algo que haces a menudo. Marcha Solo te ayudará a convertirlo en un plan claro.</p>
          <Link href="/signup" className="marketing-primary-button">Probar Marcha Solo <span aria-hidden="true">→</span></Link>
        </section>
      </main>
    </MarketingLayout>
  )
}
