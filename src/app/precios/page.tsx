import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { PLANS, TRIAL } from "@/lib/pricing"

export const metadata: Metadata = {
  title: "Precios",
  description:
    "Planes MarchaSolo desde 19 €/mes. La cuenta prepara el trabajo; tú apruebas antes de enviar o cambiar nada. La IA la pagas a tu proveedor.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/precios" },
}

const tokens = TRIAL.tokens.toLocaleString("es-ES")

export default function PricingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Precios</h1>
            <p className="site-lead">
              Elige el plan que encaje con tu ritmo de trabajo. En todos, MarchaSolo prepara las tareas y espera tu
              aprobación antes de enviar o cambiar nada. La inteligencia artificial la pagas directamente a tu proveedor.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="planes">
          <div className="site-container">
            <h2 id="planes" className="sr-only">
              Planes
            </h2>
            <div className="facts">
              {PLANS.map((p) => (
                <div key={p.id} className={p.recommended ? "fact is-key" : "fact"}>
                  {p.recommended ? (
                    <p className="site-small m-0 mb-2 font-semibold text-[var(--ms-teal,var(--ms-navy))]">
                      Recomendado para lanzamiento
                    </p>
                  ) : null}
                  <h3 className="site-h3">{p.name}</h3>
                  <p className="text-[32px] font-semibold text-[var(--ms-navy)]">
                    {p.price}{" "}
                    <span className="text-base font-normal text-[var(--ms-muted)]">{p.period}</span>
                  </p>
                  {p.priceYear ? <p className="site-small m-0 mt-1">{p.priceYear}</p> : null}
                  <p className="mt-3 text-[var(--ms-muted)]">{p.tagline}</p>
                  <ul>
                    {p.includes.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                 <Link href={`/crear-cuenta?plan=${p.id}`} className="btn btn-primary mt-6">
  {p.cta}
</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="como">
          <div className="site-container">
            <h2 id="como" className="site-h2 mb-10">
              Cómo funciona el coste
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
                <h3 className="site-h3">Créditos de prueba para empezar</h3>
                <p>
                  Tu espacio personal recibe {tokens} tokens de IA de MarchaSolo para {TRIAL.scope}: suficiente para
                  contarle tus tareas y ver los planes que te propone sin conectar nada.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">La IA, con tu propia clave</h3>
                <p>
                  Para ejecutar automatizaciones conectas OpenAI, Anthropic, DeepSeek o Grok. Cada proveedor te factura lo
                  que consumes; MarchaSolo no cobra nada encima.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">El gasto, a la vista</h3>
                <p>
                  Ves el coste estimado de cada ejecución y lo gastado en el mes. Puedes fijar un presupuesto y usar el
                  modo Ahorro para gastar menos.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <h2 id="dudas" className="site-h2 mb-8">
              Preguntas sobre el coste
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
                <summary>¿Qué pasa cuando se acaban los créditos de prueba?</summary>
                <div>
                  Tu cuenta y lo que hayas preparado siguen ahí. Para seguir con el asistente y las automatizaciones,
                  conecta tu propia clave de IA en Integraciones.
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
                <summary>¿Los precios incluyen IVA?</summary>
                <div>No. Los importes indicados no incluyen IVA.</div>
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
