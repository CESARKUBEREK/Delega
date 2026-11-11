import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"
import { PLANS } from "@/lib/pricing"

const pricingIntro = PLANS.length
  ? `Prueba gratuita. Después, planes desde ${PLANS[0].price}${PLANS[0].period}; el consumo de IA se paga directamente al proveedor elegido.`
  : "Consulta las opciones disponibles para empezar con MarchaSolo y el costo del consumo de inteligencia artificial, que se paga directamente al proveedor elegido."

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

        <section className="site-section" aria-labelledby="como">
          <div className="site-container">
            <h2 id="como" className="site-h2 mb-10">
              Una estructura de costos transparente
            </h2>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">El plan de MarchaSolo</h3>
                <p>
                  Incluye la plataforma: bandeja, asistente, automatizaciones, aprobaciones y conexiones. Las funciones de revisión y control están incluidas en todos los planes.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Prueba gratuita</h3>
                <p>
                  MarchaSolo prepara las primeras automatizaciones y permite probarlas con su IA, sin conectar una IA propia ni registrar una tarjeta.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Después de la prueba: una IA propia</h3>
                <p>
                  Para continuar ejecutando automatizaciones, se conecta una cuenta de OpenAI, Anthropic, DeepSeek o Grok. Cada proveedor factura el consumo directamente; MarchaSolo no añade un recargo por ese uso.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">El gasto, a la vista</h3>
                <p>
                  El panel muestra el costo estimado de cada ejecución y el consumo mensual. Es posible fijar un presupuesto y utilizar el modo Ahorro.
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
                  Sí. Al alcanzar el 80 % del presupuesto se envía un aviso. Al llegar al 100 %, MarchaSolo pasa al modo Ahorro o detiene el uso, según la configuración disponible.
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
                <div>Los precios están expresados en dólares estadounidenses (USD). El banco o el medio de pago puede aplicar impuestos, percepciones, conversiones o cargos adicionales según el país y la normativa vigente. Consulta las condiciones locales antes de pagar.</div>
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
