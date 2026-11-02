import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CommandDemo } from "@/components/site/command-demo"

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Le dices qué necesitas, MarchaSolo organiza el trabajo y lo ejecuta, y tú decides antes de que se envíe o cambie nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/como-funciona" },
}

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Cómo funciona</h1>
            <p className="site-lead">Cuatro pasos, siempre los mismos. Los tres primeros los hace MarchaSolo; el último es tuyo.</p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="pasos">
          <div className="site-container">
            <h2 id="pasos" className="sr-only">
              Los cuatro pasos
            </h2>
            <ol className="steps is-four">
              <li>
                <h3 className="site-h3">Dile qué necesitas</h3>
                <p>Escribe o dicta la tarea en lenguaje natural, como se la explicarías a una persona. También puedes empezar desde una plantilla.</p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo organiza el trabajo</h3>
                <p>Interpreta la petición, la convierte en pasos y te dice qué aplicaciones necesita. Puedes ajustar cualquier paso.</p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo ejecuta</h3>
                <p>Lee, consulta y redacta por su cuenta, cuando tú quieras o a la hora fijada. Ves el progreso en directo.</p>
              </li>
              <li>
                <h3 className="site-h3">Tú mantienes el control</h3>
                <p>Lo que se envía o se cambia espera tu aprobación, con el texto completo o las celdas de antes y después.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="site-section" aria-labelledby="ejemplo">
          <div className="site-container grid items-start gap-12 lg:grid-cols-2">
            <div>
              <h2 id="ejemplo" className="site-h2">Un ejemplo de principio a fin</h2>
              <p className="site-lead">Una inmobiliaria recibe cada semana consultas para ver pisos. Así queda la tarea con MarchaSolo:</p>
              <ol className="mt-8 grid gap-6 pl-5 text-[var(--ms-muted)] [&>li]:pl-1">
                <li>
                  <b className="text-[var(--ms-navy)]">Lo pide una vez.</b> «Cuando un cliente pida ver un piso, mira mi agenda y prepárale una
                  respuesta con un hueco libre».
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">MarchaSolo propone el plan.</b> Leer el correo, consultar la agenda, buscar la ficha del piso y
                  redactar la respuesta. Le pide conectar el correo y el calendario, porque los necesita.
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">Llega un correo de Laura.</b> La automatización arranca sola, hace las consultas y deja la
                  respuesta preparada.
                </li>
                <li>
                  <b className="text-[var(--ms-navy)]">Aviso en el móvil.</b> «Necesita tu aprobación». Abre la tarjeta, lee el correo completo,
                  cambia una palabra y lo aprueba. Sale desde su propio correo, en el mismo hilo.
                </li>
              </ol>
            </div>
            <CommandDemo animate={false} />
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="empezar" id="empezar">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="empezar" className="site-h2">Qué necesitas para empezar</h2>
              <p className="site-lead">Menos de lo que parece. Primero ves lo que MarchaSolo puede hacer; las conexiones llegan después, cuando hacen falta.</p>
            </div>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">Para probarlo: solo una cuenta</h3>
                <p>
                  Al crearla te preguntamos qué tarea te quita más tiempo y MarchaSolo te prepara el plan. Para eso usa unos créditos de IA de prueba
                  que pone MarchaSolo: no hace falta conectar nada.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Para que trabaje: tus aplicaciones</h3>
                <p>
                  Conecta solo lo que pida tu tarea: el correo, Drive, la agenda o el CRM. El propio plan te dice cuáles, y cada tarjeta de conexión
                  explica cómo hacerlo paso a paso.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Para ejecutar: tu propia IA</h3>
                <p>
                  Las automatizaciones usan tu cuenta de OpenAI, Anthropic, DeepSeek o Grok. Pegas tu clave una vez; se guarda cifrada y el consumo
                  se factura en tu cuenta. MarchaSolo elige en cada tarea el modelo adecuado y respeta el presupuesto que marques.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Si te atascas: el ayudante</h3>
                <p>
                  En Integraciones y en tus automatizaciones tienes un ayudante que conoce el estado de tu espacio, te guía para conectar cada cuenta y
                  te explica por qué ha fallado una ejecución.
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
                <summary>¿Puede enviar algo sin que yo lo vea?</summary>
                <div>
                  No. Correos, mensajes, cambios en planillas, documentos, CRM y agenda esperan tu aprobación. Las excepciones son los avisos que te
                  manda a ti y, solo si lo activas, las citas que reserva dentro del horario que tú fijes.
                </div>
              </details>
              <details>
                <summary>¿Tengo que saber de inteligencia artificial?</summary>
                <div>
                  No. Describes la tarea con tus palabras. Si quieres, puedes elegir entre los modos Ahorro, Inteligente o Máxima calidad, pero
                  Inteligente funciona bien sin tocar nada.
                </div>
              </details>
              <details>
                <summary>¿Qué pasa si una ejecución falla?</summary>
                <div>
                  La ejecución te dice por qué ha fallado y qué hacer, con un botón para abrir la conexión que toque o volver a intentarlo. Si tu
                  proveedor de IA se queda sin saldo, MarchaSolo puede seguir con otra IA que tengas conectada.
                </div>
              </details>
              <details>
                <summary>¿Puedo usarlo desde el móvil?</summary>
                <div>Sí. MarchaSolo se instala en el móvil desde el navegador, te avisa cuando algo espera tu aprobación y puedes dictar las peticiones.</div>
              </details>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Pruébalo con una tarea tuya</h2>
                <p>Te preparamos el plan antes de que conectes nada.</p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Probar MarchaSolo
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
