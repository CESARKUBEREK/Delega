import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { PLANS, TRIAL } from "@/lib/pricing"

export const metadata: Metadata = {
  title: "Precios",
  description:
    "MarchaSolo no cobra por la cuenta ni por las aprobaciones. Preparas el trabajo con créditos de prueba o tu propia IA; tú decides qué se envía o se cambia.",
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
              {PLANS.length
                ? "Elige el plan que encaje con tu negocio. La inteligencia artificial la pagas directamente a tu proveedor."
                : "Crear la cuenta y usar MarchaSolo no cuesta nada. Lo único que pagas es la IA, directamente a tu proveedor. El control —aprobar antes de enviar o cambiar nada— va incluido."}
            </p>
          </div>
        </section>

        {PLANS.length ? (
          <section className="site-section is-white" aria-labelledby="planes">
            <div className="site-container">
              <h2 id="planes" className="site-h2 mb-10">
                Planes
              </h2>
              <div className="facts">
                {PLANS.map((p) => (
                  <div key={p.id} className="fact">
                    <h3 className="site-h3">{p.name}</h3>
                    <p className="text-[32px] font-semibold text-[var(--ms-navy)]">
                      {p.price} <span className="text-base font-normal text-[var(--ms-muted)]">{p.period}</span>
                    </p>
                    <ul>
                      {p.includes.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                    <Link href="/crear-cuenta" className="btn btn-primary mt-6">
                      {p.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="site-section is-white" aria-labelledby="como">
          <div className="site-container">
            <h2 id="como" className="site-h2 mb-10">
              Cómo funciona el coste
            </h2>
            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">Tu cuenta de MarchaSolo</h3>
                <p>
                  Sin coste y sin tarjeta. Incluye la bandeja, el asistente, las automatizaciones, las aprobaciones y
                  todas las conexiones. Nada se envía sin tu visto bueno.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Créditos de prueba para empezar</h3>
                <p>
                  Tu espacio personal recibe {tokens} tokens de IA de MarchaSolo para {TRIAL.scope}: suficiente para
                  contarle tus tareas y ver los planes que te propone sin conectar nada. Tú decides si los pones en
                  marcha.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">La IA, con tu propia clave</h3>
                <p>
                  Para que prepare y ejecute automatizaciones conectas tu cuenta de OpenAI, Anthropic, DeepSeek o Grok.
                  Cada proveedor te factura lo que consumes; MarchaSolo no cobra nada encima.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">El gasto, a la vista</h3>
                <p>
                  Ves el coste estimado de cada ejecución y lo gastado en el mes. Puedes fijar un presupuesto diario,
                  mensual o por ejecución, y elegir el modo Ahorro para gastar menos.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <h2 id="dudas" className="site-h2 mb-8">
              Preguntas sobre el coste
            </h2>
            <div className="faq">
              <details>
                <summary>¿Qué pasa cuando se acaban los créditos de prueba?</summary>
                <div>
                  Tu cuenta y lo que hayas preparado siguen ahí. Para seguir usando el asistente y que MarchaSolo prepare
                  automatizaciones, conecta tu propia clave de IA en Integraciones.
                </div>
              </details>
              <details>
                <summary>¿Cuánto cuesta la IA en la práctica?</summary>
                <div>
                  Depende del proveedor, del modelo y de cuánto trabajo le des. MarchaSolo usa un modelo económico para las
                  tareas sencillas, como ordenar la bandeja, y te muestra el coste estimado de cada ejecución para que lo
                  veas con tus propias tareas.
                </div>
              </details>
              <details>
                <summary>¿Puedo poner un límite de gasto?</summary>
                <div>
                  Sí. Al llegar al 80 % te avisamos; al 100 %, MarchaSolo pasa al modo Ahorro, o se para si lo prefieres.
                  Una ejecución que llega a su presupuesto se detiene y te pregunta si continuar.
                </div>
              </details>
              <details>
                <summary>¿Pago algo por las aprobaciones o el control?</summary>
                <div>
                  No. Revisar, editar y aprobar antes de que se envíe o se cambie nada forma parte de cómo funciona
                  MarchaSolo. No tiene coste aparte.
                </div>
              </details>
              <details>
                <summary>¿Habrá planes de pago?</summary>
                <div>
                  {PLANS.length
                    ? "Sí: los tienes arriba."
                    : "Si los hay, se publicarán en esta página con sus condiciones. Hoy no se cobra nada por usar MarchaSolo."}
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza sin coste</h2>
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
