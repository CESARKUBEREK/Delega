import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CommandDemo } from "@/components/site/command-demo"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Cómo funciona",
  description: "Indicar un objetivo. MarchaSolo lo organiza en pasos, conecta las aplicaciones necesarias y coordina el proceso. Las acciones que requieren autorización quedan pendientes de aprobación.",
  path: "/como-funciona",
})

const FAQS = [
  {
    question: "¿Qué acciones requieren revisión antes de ejecutarse?",
    answer:
      "Las operaciones externas requieren aprobación, salvo las excepciones expresamente configuradas. Los avisos internos y las automatizaciones autorizadas pueden ejecutarse según los permisos del espacio.",
  },
  {
    question: "¿MarchaSolo puede ejecutar tareas automáticamente?",
    answer:
      "MarchaSolo puede automatizar pasos de lectura, consulta y preparación. Las acciones sensibles pueden requerir aprobación; el comportamiento depende de los permisos y las reglas configuradas.",
  },
  {
    question: "¿Tengo que saber de inteligencia artificial?",
    answer:
      "No. Basta con describir la tarea en lenguaje cotidiano. También es posible elegir entre los modos Ahorro, Inteligente o Máxima calidad.",
  },
  {
    question: "¿Qué pasa si una ejecución falla?",
    answer:
      "La ejecución informa del motivo del fallo y de los pasos disponibles, como revisar la conexión o volver a intentarlo. Si el proveedor de IA no tiene saldo, se puede utilizar otro proveedor conectado, si la configuración lo permite.",
  },
  {
    question: "¿Qué pasa cuando termina la prueba?",
    answer:
      "La cuenta, las automatizaciones y la bandeja siguen disponibles. Para continuar, se elige el plan Solo y se conecta una cuenta propia de IA (OpenAI, Anthropic, DeepSeek o Grok). MarchaSolo guía el proceso paso a paso.",
  },
  {
    question: "¿Cómo se conecta WhatsApp?",
    answer:
      "La conexión se realiza mediante un proveedor compatible con la API oficial de WhatsApp Business. La disponibilidad, los requisitos de verificación y los plazos dependen del proveedor y de la revisión de Meta. Mientras se completa el proceso, es posible comenzar con el correo y añadir WhatsApp más adelante.",
  },
  {
    question: "¿Se puede utilizar desde un teléfono móvil?",
    answer:
      "MarchaSolo puede instalarse desde el navegador del teléfono, enviar avisos cuando hay tareas pendientes y permitir dictar instrucciones.",
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
            <h1 className="site-h1">Cómo funciona</h1>
            <p className="site-lead">
              De una instrucción a un trabajo terminado: MarchaSolo organiza los pasos, conecta las aplicaciones necesarias y permite supervisar el resultado.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="pasos">
          <div className="site-container">
            <h2 id="pasos" className="sr-only">
              Los cuatro pasos
            </h2>
            <ol className="steps is-four">
              <li>
                <h3 className="site-h3">Describir la tarea</h3>
                <p>
                  Describir la tarea en lenguaje cotidiano, por escrito o mediante dictado, o seleccionar una plantilla.
                </p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo organiza el trabajo</h3>
                <p>
                  Interpreta el objetivo, lo divide en pasos e identifica las aplicaciones necesarias. El plan puede revisarse y ajustarse antes de continuar.
                </p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo prepara el trabajo</h3>
                <p>
                  Coordina consultas y tareas con las aplicaciones conectadas, bajo demanda o según el horario configurado. Prepara resultados y acciones, y muestra el avance de cada paso.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Revisión y autorización</h3>
                <p>
                  Las acciones sujetas a aprobación muestran el contenido completo o los valores anteriores y nuevos antes de ejecutarse. Las excepciones autorizadas siguen las reglas configuradas.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="site-section" aria-labelledby="ejemplo">
          <div className="site-container grid items-start gap-12 lg:grid-cols-2">
            <div>
              <h2 id="ejemplo" className="site-h2">
                Un proceso real, de principio a fin
              </h2>
              <p className="site-lead">
                Una inmobiliaria recibe consultas sobre propiedades y necesita responder, comprobar disponibilidad y registrar el seguimiento. Así coordina ese proceso con MarchaSolo:
              </p>
              <ol className="mt-8 grid gap-6 pl-5 text-[var(--ms-muted)] [&>li]:pl-1">
                <li>
                  <b className="text-[var(--ms-navy)]">Lo pide una vez.</b> «Cuando llegue una consulta para visitar una propiedad, consulta la agenda y prepara una respuesta con un horario disponible».
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">MarchaSolo propone el plan.</b> Leer el correo, consultar la agenda,
                  buscar la ficha del departamento y redactar la respuesta. Identifica la necesidad de conectar el correo electrónico y el calendario.
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">Llega un correo de Laura.</b> La automatización arranca, hace las
                  consultas y deja la respuesta preparada. El envío queda pendiente de aprobación.
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">Aviso en el teléfono.</b> «Hay una respuesta pendiente de revisión». La tarjeta permite consultar el correo completo y ajustar el texto antes de autorizar el envío desde la misma cuenta.
                </li>
              </ol>
            </div>
            <CommandDemo animate={false} />
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="empezar" id="empezar">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="empezar" className="site-h2">
                Qué necesitas para empezar
              </h2>
              <p className="site-lead">
                Menos de lo que parece. Primero ves la propuesta; las conexiones llegan después, cuando hacen falta.
              </p>
            </div>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">Para probarlo: solo una cuenta</h3>
                <p>
                  Al crearla, se puede indicar qué tarea conviene mejorar. MarchaSolo prepara una propuesta para probar con su IA, sin conectar una IA propia. Si se conecta el correo, también puede organizar la bandeja.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Para que trabaje: las aplicaciones del negocio</h3>
                <p>
                  Solo se conectan los servicios necesarios para cada tarea: correo, Drive, calendario o CRM. Cada tarjeta dirige al proveedor y explica el proceso de conexión.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Después de la prueba: una cuenta propia de IA</h3>
                <p>
                  Después de la prueba, las automatizaciones utilizan una cuenta propia de OpenAI, Anthropic, DeepSeek o Grok. La clave se guarda cifrada y el consumo se factura directamente en esa cuenta. MarchaSolo selecciona el modelo según la tarea y respeta el presupuesto configurado.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Asistencia para la configuración</h3>
                <p>
                  En Integraciones y en las automatizaciones hay un asistente que conoce el estado del espacio, guía la conexión de cada cuenta y explica los motivos de los fallos.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <h2 id="dudas" className="site-h2 mb-8">
              Dudas habituales
            </h2>
            <div className="faq">
              <details>
                <summary>¿Qué acciones requieren revisión antes de ejecutarse?</summary>
                <div>
                  Las acciones externas configuradas para aprobación quedan pendientes de revisión. Los avisos internos y las automatizaciones expresamente autorizadas pueden ejecutarse según los permisos del espacio.
                </div>
              </details>
              <details>
                <summary>¿Es un agente que actúa solo?</summary>
                <div>
                  MarchaSolo automatiza tareas de lectura, consulta y preparación. Las acciones sensibles pueden requerir autorización según los permisos y reglas configurados.
                </div>
              </details>
              <details>
                <summary>¿Tengo que saber de inteligencia artificial?</summary>
                <div>
                  No. Basta con describir la tarea en lenguaje cotidiano. También se puede elegir entre los modos Ahorro, Inteligente o Máxima calidad.
                </div>
              </details>
              <details>
                <summary>¿Qué pasa si una ejecución falla?</summary>
                <div>
                  La ejecución informa del motivo del fallo y de los pasos disponibles, como revisar la conexión o volver a intentarlo. Si el proveedor de IA no tiene saldo, se puede utilizar otro proveedor conectado, si la configuración lo permite.
                </div>
              </details>
              <details>
                <summary>¿Se puede utilizar desde un teléfono?</summary>
                <div>
                  MarchaSolo puede instalarse desde el navegador del teléfono, enviar avisos cuando hay tareas pendientes y permitir dictar instrucciones.
                </div>
              </details>
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
                <h2 className="site-h2">Comenzar con un proceso real</h2>
                <p>
                  MarchaSolo prepara una propuesta antes de conectar las aplicaciones y permite probarla sin costo inicial.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
