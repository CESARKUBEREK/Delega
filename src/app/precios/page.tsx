import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"
import { PLANS } from "@/lib/pricing"

const pricingIntro = PLANS.length
  ? `Planes MarchaSolo desde ${PLANS[0].price}${PLANS[0].period}. La IA se paga directamente a tu proveedor.`
  : "Hoy MarchaSolo no tiene planes de pago: crear la cuenta y usarlo no cuesta nada. Lo único que pagas es la inteligencia artificial, directamente a tu proveedor."

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
            <h1 className="site-h1">Precios</h1>
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
              Cómo funciona el costo
            </h2>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">El plan de MarchaSolo</h3>
                <p>
                  Cubre el producto: bandeja, asistente, automatizaciones, aprobaciones y conexiones. El control —nada se
                  envía sin tu visto bueno— va incluido en todos los planes.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Pruébalo gratis</h3>
                <p>
                  Te preparamos tus primeras automatizaciones y las ponemos a trabajar con nuestra IA, sin que conectes nada
                  ni pongas tarjeta.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Después, la IA con tu propia clave</h3>
                <p>
                  Para seguir ejecutando automatizaciones conectas OpenAI, Anthropic, DeepSeek o Grok. Cada proveedor te factura lo
                  que consumes; MarchaSolo no cobra nada encima.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">El gasto, a la vista</h3>
                <p>
                  Ves el costo estimado de cada ejecución y lo gastado en el mes. Puedes fijar un presupuesto y usar el
                  modo Ahorro para gastar menos.
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
                  No. El plan cubre MarchaSolo (producto, aprobaciones y conexiones). La IA la pagas a tu proveedor con tu
                  propia clave, según lo que consumas.
                </div>
              </details>
              <details>
                <summary>¿Qué incluye la prueba y qué pasa cuando termina?</summary>
                <div>
                  La prueba usa nuestra IA, por nuestra cuenta, y alcanza para decenas de tareas. Cuando se termina, tu cuenta y lo que hayas preparado siguen ahí: pasas al plan Solo y conectas tu propia
                  clave de IA. El propio MarchaSolo te guía y te lleva a la web del proveedor.
                </div>
              </details>
              <details>
                <summary>¿Puedo poner un límite de gasto de IA?</summary>
                <div>
                  Sí. Al llegar al 80 % te avisamos; al 100 %, MarchaSolo pasa al modo Ahorro, o se para si lo prefieres.
                </div>
              </details>
              <details>
                <summary>¿Pago algo extra por las aprobaciones?</summary>
                <div>
                  No. Revisar y aprobar antes de que se envíe o se cambie nada forma parte de todos los planes.
                </div>
              </details>
              <details>
                <summary>¿Los precios incluyen impuestos?</summary>
                <div>Los precios están en dólares (USD). Según tu país, tu banco puede sumar impuestos locales al pagar con tarjeta: en Argentina, el IVA y la percepción a cuenta de Ganancias, que puedes recuperar en tu declaración.</div>
              </details>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza con el plan que te encaje</h2>
                <p>
                  Crea la cuenta, cuéntale una tarea y mira el plan que te prepara. Tú decides si lo pones en marcha.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Probar gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
