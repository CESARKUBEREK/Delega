import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"
import { PLANS } from "@/lib/pricing"

const pricingIntro =
  "Elegir el nivel de automatización adecuado, con una estructura de costos transparente y control sobre el consumo de inteligencia artificial."

export const metadata = publicPageMetadata({
  title: "Precios",
  description: pricingIntro,
  path: "/precios",
})

export default function PricingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Un plan para cada etapa del negocio.</h1>
            <p className="site-lead">{pricingIntro}</p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="planes">
          <div className="site-container">
            <h2 id="planes" className="sr-only">
              Planes
            </h2>
            <div className="facts">
              {PLANS.map((plan) => (
                <div key={plan.id} id={plan.id} className={plan.recommended ? "fact is-key scroll-mt-24" : "fact scroll-mt-24"}>
                  {plan.recommended ? (
                    <p className="site-small m-0 mb-2 font-semibold text-[var(--ms-teal,var(--ms-navy))]">
                      Recomendado para lanzamiento
                    </p>
                  ) : null}
                  <h3 className="site-h3">{plan.name}</h3>
                  <p className="text-[32px] font-semibold text-[var(--ms-navy)]">
                    {plan.price}{" "}
                    <span className="text-base font-normal text-[var(--ms-muted)]">{plan.period}</span>
                  </p>
                  {plan.priceYear ? <p className="site-small m-0 mt-1">{plan.priceYear}</p> : null}
                  <p className="mt-3 text-[var(--ms-muted)]">{plan.tagline}</p>
                  <ul>
                    {plan.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link href={`/crear-cuenta?plan=${plan.id}`} className="btn btn-primary mt-6">
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="costos">
          <div className="site-container">
            <h2 id="costos" className="site-h2 mb-10">
              Una estructura de costos transparente
            </h2>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">El plan de MarchaSolo</h3>
                <p>
                  Incluye el acceso a la plataforma, la bandeja, el asistente, las automatizaciones, las integraciones y las herramientas de revisión y aprobación. Estas funciones están incluidas en todos los planes.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Inteligencia artificial</h3>
                <p>
                  La prueba inicial permite preparar y probar automatizaciones con la IA de MarchaSolo, sin conectar una cuenta propia ni registrar una tarjeta. Después de la prueba, para continuar con las ejecuciones se conecta una cuenta de OpenAI, Anthropic, DeepSeek o Grok.
                </p>
                <p>
                  El consumo se factura directamente a través del proveedor elegido. MarchaSolo no añade un recargo por ese uso.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Control del gasto</h3>
                <p>
                  El costo de la inteligencia artificial depende del proveedor, el modelo y el volumen de uso. La consulta del consumo y la configuración de límites deben realizarse de acuerdo con las herramientas disponibles en la cuenta del proveedor.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Transparencia</h3>
                <p>
                  Los precios de los planes están expresados en dólares estadounidenses (USD). El banco o el medio de pago puede aplicar impuestos, percepciones, conversiones o cargos adicionales según el país y la normativa vigente. Conviene consultar las condiciones locales antes de pagar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <h2 id="dudas" className="site-h2 mb-8">
              Preguntas sobre el costo
            </h2>
            <div className="faq">
              <details>
                <summary>¿El precio del plan incluye la IA?</summary>
                <div>
                  No. El plan cubre MarchaSolo (plataforma, aprobaciones y conexiones). El consumo de IA se factura por separado a través del proveedor y la cuenta conectados.
                </div>
              </details>
              <details>
                <summary>¿Qué incluye la prueba y qué pasa cuando termina?</summary>
                <div>
                  La prueba utiliza la IA de MarchaSolo e incluye un cupo de uso limitado. Al terminar, la cuenta y las automatizaciones preparadas permanecen disponibles. Para continuar, se elige un plan y se conecta una cuenta de IA propia. MarchaSolo guía el proceso.
                </div>
              </details>
              <details>
                <summary>¿Puedo poner un límite de gasto de IA?</summary>
                <div>
                  Los límites y alertas de consumo dependen de las herramientas disponibles en el proveedor de inteligencia artificial conectado. Se recomienda revisar y configurar esos controles directamente en la cuenta correspondiente.
                </div>
              </details>
              <details>
                <summary>¿Pago algo extra por las aprobaciones?</summary>
                <div>
                  No. Las funciones de revisión y aprobación de acciones están incluidas en todos los planes.
                </div>
              </details>
              <details>
                <summary>¿Los precios incluyen impuestos?</summary>
                <div>
                  Los precios están expresados en dólares estadounidenses (USD). El banco o el medio de pago puede aplicar impuestos, percepciones, conversiones o cargos adicionales según el país y la normativa vigente. Conviene consultar las condiciones locales antes de pagar.
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Elegir el plan adecuado para cada etapa</h2>
                <p>
                  Crear una cuenta, describir una tarea y probar la propuesta que prepara MarchaSolo, sin costo inicial.
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
