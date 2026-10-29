import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"

export const metadata: Metadata = {
  title: "Cómo empezar",
  description: "Conecta tus herramientas paso a paso y crea tu primera automatización con Marcha Solo.",
  robots: { index: true, follow: true },
}

const steps = [
  {
    number: "01",
    eyebrow: "PRIMERO, LA IA",
    title: "Conecta un proveedor de IA",
    body: "En tu espacio, abre Integraciones → LLMs. Añade una clave de OpenAI, Anthropic o DeepSeek y elige el proveedor principal. Puedes empezar con una sola conexión.",
    tip: "El dictado por voz utiliza OpenAI.",
  },
  {
    number: "02",
    eyebrow: "TUS ARCHIVOS",
    title: "Elige los documentos y las planillas",
    body: "Conecta Google Drive y selecciona los archivos que Marcha Solo puede consultar o actualizar. Añade solo los documentos y planillas que te ayuden con tus tareas.",
    tip: "Por ejemplo: pedidos, presupuestos, clientes o procedimientos.",
  },
  {
    number: "03",
    eyebrow: "MENSAJES Y AGENDA",
    title: "Conecta los canales que usas",
    body: "Configura el correo, WhatsApp o Telegram para centralizar mensajes y crear automatizaciones a partir de ellos. Si trabajas con citas, conecta Google Calendar.",
    tip: "Puedes añadir cada conexión cuando la necesites.",
  },
  {
    number: "04",
    eyebrow: "CLIENTES Y SECTOR",
    title: "Añade tu CRM o herramientas de trabajo",
    body: "Conecta HubSpot para trabajar con contactos y negocios. Si usas herramientas inmobiliarias o contables disponibles en Integraciones, puedes añadirlas también.",
    tip: "No hace falta conectar todos tus servicios para empezar.",
  },
  {
    number: "05",
    eyebrow: "TU PRIMER PLAN",
    title: "Describe una tarea cotidiana",
    body: "Abre el Asistente y explica qué necesitas con tus propias palabras. Marcha Solo preparará una propuesta de flujo. También puedes empezar desde una plantilla.",
    tip: "Cuanto más concreto sea el objetivo, más fácil será revisar el plan.",
  },
  {
    number: "06",
    eyebrow: "LISTO PARA AVANZAR",
    title: "Revisa, prueba y decide",
    body: "Ajusta los pasos, elige cuándo quieres que se ejecute y prueba la automatización. Cuando esté lista, podrás activarla. Las acciones que requieran aprobación te pedirán confirmación.",
    tip: "Empieza con una tarea sencilla y mejora el flujo con la práctica.",
  },
]

export default function GettingStartedPage() {
  return (
    <MarketingLayout>
      <main className="marketing-main marketing-guide">
        <section className="marketing-guide-hero">
          <p className="marketing-eyebrow"><span /> TU PRIMERA AUTOMATIZACIÓN, PASO A PASO</p>
          <h1>Empieza por tus integraciones.<br /><em>Sigue a tu ritmo.</em></h1>
          <p className="marketing-lead">
            Conecta solo las herramientas que necesitas. Después, convierte una tarea repetida en un plan que puedas revisar y poner en marcha.
          </p>
          <Link href="/signup" className="marketing-primary-button">Crear mi espacio <span aria-hidden="true">→</span></Link>
        </section>

        <section className="marketing-setup-note">
          <span className="marketing-setup-icon">↗</span>
          <p><b>¿Dónde se configuran?</b> Dentro de tu espacio, abre <strong>Integraciones</strong>. Puedes volver aquí cuando quieras para seguir con el próximo paso.</p>
        </section>

        <section className="marketing-steps" aria-label="Pasos para empezar con Marcha Solo">
          {steps.map((step) => (
            <article className="marketing-step" key={step.number}>
              <div className="marketing-step-index">{step.number}</div>
              <div className="marketing-step-content">
                <p className="marketing-eyebrow">{step.eyebrow}</p>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                <div className="marketing-step-tip"><span>IDEA</span>{step.tip}</div>
              </div>
            </article>
          ))}
        </section>

        <section className="marketing-guide-prompt">
          <div>
            <p className="marketing-eyebrow">YA PUEDES PROBARLO</p>
            <h2>Empieza con una tarea<br /><em>que te gustaría dejar de repetir.</em></h2>
            <p>Cuéntasela al Asistente, revisa lo que propone y adapta el plan a tu forma de trabajar.</p>
          </div>
          <div className="marketing-prompt-example">
            <span>UNA PETICIÓN PARA EMPEZAR</span>
            <p>“Cuando llegue una consulta de presupuesto, clasifícala, resume lo que necesita el cliente y prepara una respuesta para que la revise.”</p>
            <Link href="/signup">Crear mi espacio <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
