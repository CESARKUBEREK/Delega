import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"
import { PLANS } from "@/lib/pricing"

const pricingIntro =
  "Elige un plan y empieza a trabajar. Cada plan incluye la IA de MarchaSolo con un número de tareas al mes. Si ya tienes una cuenta de OpenAI, Anthropic, DeepSeek o Grok, puedes conectarla y usar MarchaSolo sin límite de tareas."

export const metadata = publicPageMetadata({
  title: "Precios",
  description:
    "Planes Solo, Negocio y Equipo de MarchaSolo, con la IA incluida y un número de tareas al mes. Prueba gratis 14 días, sin tarjeta.",
  path: "/precios",
})

export default function PricingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-teal-ink)]">
              Precios
            </p>
            <h1 className="site-h1">Tu trabajo, en marcha. La IA ya va incluida.</h1>
            <p className="site-lead">{pricingIntro}</p>
            <div className="site-actions">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Pruébalo gratis 14 días
              </Link>
              <Link href="/como-funciona" className="btn btn-secondary">
                Cómo funciona
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--ms-muted)]">
              Sin tarjeta. Nada sale sin tu aprobación.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="planes">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="planes" className="site-h2">
                Elige cuánto trabajo quieres quitarte de encima
              </h2>
              <p className="site-lead">
                Todos los planes incluyen la IA, la bandeja ordenada y la aprobación de cada acción.
                Cambian las tareas al mes, los canales y las personas del equipo.
              </p>
            </div>

            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <article
                  key={plan.id}
                  id={plan.id}
                  className={`fact flex h-full scroll-mt-24 flex-col ${plan.recommended ? "is-key" : ""}`}
                >
                  {plan.recommended ? (
                    <p className="site-small m-0 mb-3 font-semibold text-[var(--ms-teal-ink)]">
                      Recomendado
                    </p>
                  ) : (
                    <p className="site-small m-0 mb-3 text-[var(--ms-muted)]">
                      Plan MarchaSolo
                    </p>
                  )}
                  <h3 className="site-h3">{plan.name}</h3>
                  <p className="mt-5 text-[32px] font-semibold leading-tight text-[var(--ms-navy)]">
                    {plan.price}
                    <span className="text-base font-normal text-[var(--ms-muted)]">
                      {" "}{plan.period}
                    </span>
                  </p>
                  {plan.priceYear ? (
                    <p className="site-small m-0 mt-2">{plan.priceYear}</p>
                  ) : (
                    <p className="site-small m-0 mt-2">Facturación mensual</p>
                  )}
                  <p className="mt-4 min-h-12 text-[var(--ms-muted)]">{plan.tagline}</p>
                  <div className="my-5 border-t border-[var(--ms-line)]" />
                  <p className="mb-1 text-sm font-semibold">Incluye</p>
                  <ul className="flex-1">
                    {plan.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/crear-cuenta?plan=${plan.id}`}
                    className="btn btn-primary mt-7 w-full justify-center"
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-[var(--ms-muted)]">
              Precios en dólares estadounidenses (USD). Una tarea es una automatización ejecutada
              o una respuesta preparada; ordenar tu bandeja no cuenta.
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="incluido">
          <div className="site-container">
            <div className="site-section-head">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-teal-ink)]">
                Sin sorpresas
              </p>
              <h2 id="incluido" className="site-h2">
                Qué incluye tu plan y qué se paga aparte
              </h2>
              <p className="site-lead">
                La IA va incluida. Solo se pagan aparte los mensajes de WhatsApp que cobra Meta.
              </p>
            </div>

            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">Qué es una tarea</h3>
                <p>
                  Cada vez que MarchaSolo hace un trabajo por ti: ejecutar una automatización o
                  prepararte una respuesta. Ordenar tu bandeja no cuenta.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Si llegas al límite</h3>
                <p>
                  Te avisamos antes. Si llegas al límite, MarchaSolo pausa lo que usa IA hasta el mes
                  siguiente. Nunca te cobramos de más sin preguntarte.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Con tu propia IA</h3>
                <p>
                  Si conectas tu cuenta de OpenAI, Anthropic, DeepSeek o Grok, no hay límite de
                  tareas. Ese consumo lo factura tu proveedor, sin recargo de MarchaSolo.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">WhatsApp</h3>
                <p>
                  Los mensajes de WhatsApp que cobra Meta se pagan con tu tarjeta en tu cuenta de
                  Meta.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Impuestos y moneda</h3>
                <p>
                  Precios en USD. Según tu país y tu medio de pago, el banco puede sumar impuestos o
                  percepciones.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="dudas">
          <div className="site-container max-w-3xl">
            <div className="site-section-head">
              <h2 id="dudas" className="site-h2">
                Preguntas frecuentes sobre los precios
              </h2>
            </div>
            <div className="faq">
              <details>
                <summary>¿La IA está incluida?</summary>
                <div>
                  Sí. Cada plan trae tareas al mes con la IA de MarchaSolo. Si prefieres usar tu
                  propia cuenta, la conectas y no tienes límite.
                </div>
              </details>
              <details>
                <summary>¿Qué plan me conviene para empezar?</summary>
                <div>
                  Si trabajas solo y quieres ordenar tu correo y tu agenda, Solo. Si atiendes a tus
                  clientes por WhatsApp, Negocio. Si son varias personas, Equipo.
                </div>
              </details>
              <details>
                <summary>¿Cuántas tareas necesito?</summary>
                <div>
                  Un resumen diario y un repaso de correos sin responder son unas 45 tareas al mes.
                  Con Solo te sobra para empezar.
                </div>
              </details>
              <details>
                <summary>¿Qué pasa al terminar la prueba?</summary>
                <div>
                  La prueba dura 14 días. Tu cuenta y tus automatizaciones siguen ahí. Para que
                  sigan trabajando, eliges un plan.
                </div>
              </details>
              <details>
                <summary>¿Puedo cambiar de plan?</summary>
                <div>Sí, cuando quieras. El cambio se aplica en el próximo periodo.</div>
              </details>
              <details>
                <summary>¿Las aprobaciones cuentan como tareas?</summary>
                <div>No. Revisar y aprobar está incluido siempre.</div>
              </details>
              <details>
                <summary>¿Los precios incluyen impuestos?</summary>
                <div>
                  Los precios se muestran en USD. Los impuestos, percepciones, conversiones o
                  cargos adicionales pueden variar según tu país y tu medio de pago.
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza por una tarea. Amplía cuando lo necesites.</h2>
                <p>
                  Crea tu cuenta y pruébalo 14 días con tu correo. Sin tarjeta y sin conectar tu
                  propia IA.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Pruébalo gratis 14 días
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
