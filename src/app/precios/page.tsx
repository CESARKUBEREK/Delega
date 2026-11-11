import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"
import { PLANS } from "@/lib/pricing"

const pricingIntro =
  "Empieza con las automatizaciones que necesitas hoy y amplía tu capacidad cuando tu negocio lo requiera. Precios en USD y condiciones claras desde el principio."

export const metadata = publicPageMetadata({
  title: "Precios",
  description:
    "Compara los planes MarchaSolo Solo, Pro y Business. Elige cuántas automatizaciones necesitas y conoce qué incluye el plan y qué servicios se pagan por separado.",
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
            <h1 className="site-h1">Empieza con lo que necesitas. Crece a tu ritmo.</h1>
            <p className="site-lead">{pricingIntro}</p>
            <div className="site-actions">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
              <Link href="/como-funciona" className="btn btn-secondary">
                Cómo funciona
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--ms-muted)]">
              Todos los planes incluyen revisión y aprobación de acciones.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="planes">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="planes" className="site-h2">
                Elige el nivel de automatización que acompaña tu trabajo
              </h2>
              <p className="site-lead">
                La diferencia está en la cantidad de automatizaciones, la variedad de conexiones
                y la capacidad de coordinar procesos y personas.
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
                      Para empezar
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
              Los importes están expresados en dólares estadounidenses (USD). El detalle de cada
              plan se basa en las condiciones comerciales vigentes de MarchaSolo.
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
                Qué pagas a MarchaSolo y qué se paga por separado
              </h2>
              <p className="site-lead">
                El plan cubre el uso de MarchaSolo. Algunos servicios externos tienen sus propias
                condiciones y facturación.
              </p>
            </div>

            <div className="facts">
              <div className="fact is-key">
                <h3 className="site-h3">Incluido en tu plan</h3>
                <p>
                  El acceso a MarchaSolo, las automatizaciones según el límite de tu plan, las
                  integraciones disponibles, el historial de ejecuciones y las herramientas para
                  revisar y aprobar acciones.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Consumo de servicios de IA</h3>
                <p>
                  La prueba inicial permite preparar y probar automatizaciones con la IA de
                  MarchaSolo, sin conectar una cuenta propia ni registrar una tarjeta. Al terminar
                  la prueba, para continuar con las ejecuciones se conecta una cuenta propia de
                  OpenAI, Anthropic, DeepSeek o Grok.
                </p>
                <p>
                  El proveedor elegido factura directamente ese consumo. MarchaSolo no añade un
                  recargo por su uso.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Control del consumo</h3>
                <p>
                  El costo depende del proveedor, el modelo y el volumen de uso. Puedes consultar
                  el consumo y configurar límites desde las herramientas que ofrezca el proveedor
                  conectado.
                </p>
              </div>
              <div className="fact">
                <h3 className="site-h3">Impuestos y moneda</h3>
                <p>
                  Los precios de MarchaSolo están expresados en dólares estadounidenses (USD).
                  Según el país, el banco o el medio de pago puede aplicar impuestos, percepciones,
                  conversiones o cargos adicionales. Consulta las condiciones locales antes de
                  realizar el pago.
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
                <summary>¿Qué plan me conviene para empezar?</summary>
                <div>
                  Si quieres automatizar algunas tareas individuales, puedes comenzar con Solo.
                  Pro está pensado para coordinar más automatizaciones y varias aplicaciones.
                  Business suma usuarios, procesos compartidos y herramientas de supervisión del
                  equipo.
                </div>
              </details>
              <details>
                <summary>¿El precio del plan incluye el consumo de IA?</summary>
                <div>
                  No. El plan cubre MarchaSolo. Después de la prueba inicial, el consumo de los
                  servicios de IA se factura directamente a través del proveedor y la cuenta que
                  conectes.
                </div>
              </details>
              <details>
                <summary>¿Qué pasa cuando termina la prueba?</summary>
                <div>
                  La cuenta y las automatizaciones preparadas permanecen disponibles. Para
                  continuar con las ejecuciones, eliges un plan y conectas una cuenta propia de un
                  proveedor de IA compatible. MarchaSolo guía el proceso.
                </div>
              </details>
              <details>
                <summary>¿Puedo controlar cuánto gasto en servicios de IA?</summary>
                <div>
                  Los límites y las alertas dependen de las herramientas disponibles en el
                  proveedor conectado. Puedes revisar y configurar esos controles directamente
                  desde la cuenta correspondiente.
                </div>
              </details>
              <details>
                <summary>¿Las aprobaciones tienen un costo adicional?</summary>
                <div>
                  No. Las funciones de revisión y aprobación de acciones están incluidas en todos
                  los planes.
                </div>
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
                  Crea tu cuenta, prueba una automatización y elige el plan que acompañe el
                  crecimiento de tu trabajo.
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
