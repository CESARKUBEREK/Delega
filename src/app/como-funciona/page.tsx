import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CommandDemo } from "@/components/site/command-demo"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Cómo funciona MarchaSolo",
  description:
    "Conoce cómo MarchaSolo convierte una tarea cotidiana en un proceso coordinado: defines qué necesitas, conectas tus aplicaciones y supervisas cada paso.",
  path: "/como-funciona",
})

const STEPS = [
  {
    number: "01",
    title: "Elige una tarea",
    description:
      "Empieza por algo que se repite y te quita tiempo: responder consultas, hacer seguimientos, organizar información o preparar documentos.",
    detail: "No necesitas cambiar la forma de trabajar de todo tu negocio.",
  },
  {
    number: "02",
    title: "Explica qué necesitas",
    description:
      "Escribe la tarea con tus propias palabras o parte de un ejemplo. MarchaSolo organiza el objetivo en pasos y te muestra qué aplicaciones necesita.",
    detail: "Puedes revisar y ajustar la propuesta antes de ponerla en marcha.",
  },
  {
    number: "03",
    title: "Conecta las aplicaciones",
    description:
      "Autoriza solo los servicios que intervienen en ese proceso: por ejemplo, correo, calendario, archivos, mensajería o CRM.",
    detail: "Cada conexión se configura desde el proveedor correspondiente.",
  },
  {
    number: "04",
    title: "Supervisa el resultado",
    description:
      "Sigue el avance, consulta lo que se ha preparado y revisa las acciones que necesitan tu autorización antes de ejecutarse.",
    detail: "Mantienes visibilidad y control sobre el proceso.",
  },
] as const

const FAQS = [
  {
    question: "¿Necesito conocimientos técnicos?",
    answer:
      "No. Puedes describir lo que necesitas con palabras cotidianas y seguir la configuración paso a paso. Solo tienes que conectar las aplicaciones que el proceso vaya a utilizar.",
  },
  {
    question: "¿Tengo que conectar todas mis aplicaciones?",
    answer:
      "No. Cada proceso utiliza únicamente las aplicaciones necesarias. Puedes comenzar con una conexión y sumar otras cuando amplíes la automatización.",
  },
  {
    question: "¿MarchaSolo realiza acciones sin consultarme?",
    answer:
      "Depende de los permisos y las reglas que configures. Las acciones externas sujetas a aprobación quedan pendientes para que puedas revisar, editar, autorizar o descartar antes de ejecutarlas.",
  },
  {
    question: "¿Puedo empezar con una sola tarea?",
    answer:
      "Sí. Lo recomendable es elegir una tarea concreta, probar el proceso y ajustarlo. Cuando te resulte útil, puedes incorporar otros pasos o crear nuevas automatizaciones.",
  },
] as const

const FAQ_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
}

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
              Cómo funciona
            </p>
            <h1 className="site-h1">De una tarea cotidiana a un proceso que avanza.</h1>
            <p className="site-lead">
              Le cuentas a MarchaSolo qué necesitas resolver. MarchaSolo organiza los pasos,
              conecta las aplicaciones necesarias y te permite seguir el trabajo y decidir
              sobre las acciones que requieren tu autorización.
            </p>
            <div className="site-actions mt-8">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
              <Link href="/para-que-sirve" className="btn btn-secondary">
                Descubrir para qué sirve
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--ms-muted)]">
              Sin conocimientos técnicos. Empieza con una tarea y amplía a tu ritmo.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="pasos">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="pasos" className="site-h2">
                Cuatro pasos para ponerlo en marcha.
              </h2>
              <p className="site-lead">
                No tienes que diseñar un sistema complejo. Empiezas por el trabajo que quieres
                simplificar y avanzas paso a paso.
              </p>
            </div>
            <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-rule bg-paper p-5">
                  <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">
                    {step.number}
                  </span>
                  <h3 className="site-h3 mt-3">{step.title}</h3>
                  <p className="mt-2 text-sm text-graphite">{step.description}</p>
                  <p className="mt-4 text-xs font-medium text-[var(--ms-muted)]">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="site-section" aria-labelledby="ejemplo">
          <div className="site-container grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                Un ejemplo práctico
              </p>
              <h2 id="ejemplo" className="site-h2">
                Del primer contacto al seguimiento, sin empezar de cero cada vez.
              </h2>
              <p className="site-lead mt-4">
                Imagina que cada día recibes consultas de posibles clientes. Para darles
                seguimiento, necesitas revisar mensajes, buscar información y preparar una
                respuesta.
              </p>
              <ul className="mt-6 grid gap-4 text-sm text-graphite">
                <li>
                  <strong className="text-[var(--ms-navy)]">La instrucción:</strong> explicas
                  qué información reunir y qué seguimiento quieres preparar.
                </li>
                <li>
                  <strong className="text-[var(--ms-navy)]">El proceso:</strong> MarchaSolo
                  coordina la consulta de los canales y herramientas conectados y reúne el
                  contexto disponible.
                </li>
                <li>
                  <strong className="text-[var(--ms-navy)]">El resultado:</strong> deja el
                  seguimiento preparado para que puedas revisarlo y autorizar el envío cuando
                  corresponda.
                </li>
              </ul>
              <p className="mt-7">
                <Link href="/casos-de-uso" className="link">
                  Ver más ejemplos de automatización →
                </Link>
              </p>
            </div>
            <CommandDemo animate={false} />
          </div>
        </section>

        <section className="site-section is-navy" aria-labelledby="control">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="control" className="site-h2">
                La automatización avanza. Tú mantienes el control.
              </h2>
              <p className="site-lead">
                Puedes ver cómo se organiza el trabajo y qué ocurre en cada paso. Las acciones
                externas sujetas a aprobación esperan tu revisión.
              </p>
            </div>
            <div className="trust">
              <div>
                <h3 className="site-h3">Pasos visibles</h3>
                <p>
                  Consulta el proceso, el estado de cada paso y los resultados que se van
                  preparando.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Decisiones bajo tu control</h3>
                <p>
                  Cuando una acción necesita autorización, puedes revisar su contenido y
                  aprobarla, editarla o descartarla según las opciones disponibles.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Empieza de forma gradual</h3>
                <p>
                  Configura una tarea, comprueba cómo funciona y ajusta sus pasos antes de
                  incorporar otros procesos.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="conexiones">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="conexiones" className="site-h2">
                Conecta solo lo que necesitas.
              </h2>
              <p className="site-lead">
                MarchaSolo coordina el trabajo entre las herramientas que ya utilizas. Las
                conexiones dependen de cada proceso y puedes incorporarlas cuando hagan falta.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="site-h3">Comunicación</h3>
                <p className="text-sm text-graphite">
                  Correo y canales de mensajería para reunir consultas y preparar respuestas.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Información y organización</h3>
                <p className="text-sm text-graphite">
                  Archivos, documentos, hojas de cálculo y calendario para consultar y organizar
                  información.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Gestión del negocio</h3>
                <p className="text-sm text-graphite">
                  CRM y otras herramientas para mantener el seguimiento de clientes y procesos.
                </p>
              </div>
            </div>
            <p className="mt-8">
              <Link href="/integraciones" className="link">
                Consultar aplicaciones e integraciones →
              </Link>
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <h2 id="dudas" className="site-h2 mb-8">
              Preguntas frecuentes
            </h2>
            <div className="faq">
              {FAQS.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <div>{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_STRUCTURED_DATA).replace(/</g, "\\u003c") }}
        />

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza por el trabajo que más tiempo te quita.</h2>
                <p>
                  Elige una tarea, explica qué necesitas y descubre cómo MarchaSolo puede
                  ayudarte a coordinarla.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
