import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { AppPreview, GuaranteeStrip } from "@/components/site/app-preview"
import { publicPageMetadata } from "@/lib/seo"
import { USE_CASES } from "@/lib/site-content"

export const metadata = publicPageMetadata({
  title: "Tu trabajo, en marcha",
  absoluteTitle: "MarchaSolo · Tu trabajo, en marcha, sin hacerlo todo tú",
  description:
    "Un compañero de trabajo con IA: ordena tu correo, prepara las respuestas a tus clientes y se detiene antes de enviar o cambiar nada. Pruébalo gratis con nuestra IA, sin tarjeta.",
  path: "/",
})

// Portada pública, también con sesión (el logo de la app lleva aquí); la
// cabecera cambia «Entrar» por «Ir a mi espacio».
export default function HomePage() {
  // Lo que más se usa al empezar: la bandeja, WhatsApp y el caso inmobiliario.
  const preview = ["bandeja-clientes", "whatsapp-negocio", "inmobiliaria-tokko"]
    .map((id) => USE_CASES.find((c) => c.id === id))
    .filter((c): c is (typeof USE_CASES)[number] => Boolean(c))
  return (
    <MarketingLayout>
      <main>
        {/* 1. Hero */}
        <section className="site-hero">
          <div className="site-container site-hero-grid">
            <div className="site-hero-copy">
              <p className="site-kicker site-hero-kicker">TU COMPAÑERO DE TRABAJO CON IA</p>
              <h1 className="site-display">
                Tu trabajo. En marcha.
                <span>Sin hacerlo todo tú.</span>
              </h1>
              <p className="site-lead site-hero-lead">
                Ordena tu correo, deja listas las respuestas a tus clientes y te avisa de lo importante. Tú revisas y
                apruebas antes de que salga nada.
              </p>
              <div className="site-actions">
                <Link href="/crear-cuenta" className="btn btn-primary">
                  Probar gratis
                </Link>
                <Link href="/como-funciona" className="btn btn-secondary">
                  Ver cómo funciona
                </Link>
              </div>
              <ul className="site-hero-note">
                <li>Sin tarjeta</li>
                <li>Listo en minutos, sin conectar tu IA</li>
                <li>Tú apruebas antes de enviar</li>
              </ul>
            </div>
            <div className="site-hero-preview">
              <AppPreview />
              <p className="site-preview-caption">
                <span aria-hidden="true">✓</span>
                La respuesta queda lista. Tú decides si se envía.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Barra de confianza */}
        <GuaranteeStrip />

        {/* 3. Cómo funciona (3 pasos) */}
        <section className="site-section is-white" aria-labelledby="pasos">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="pasos" className="site-h2">
                Así de simple
              </h2>
              <p className="site-lead">
                Se lo pides como a alguien de tu equipo. Él prepara el trabajo; la decisión final es siempre tuya.
              </p>
            </div>
            <ol className="steps">
              <li>
                <h3 className="site-h3">Dile qué quieres quitarte de encima</h3>
                <p>Elige un ejemplo o escríbelo con tus palabras. En unos segundos tienes la propuesta.</p>
              </li>
              <li>
                <h3 className="site-h3">Pruébalo con tu correo</h3>
                <p>Con nuestra IA, gratis: ordena tu bandeja y deja las respuestas preparadas desde el primer día.</p>
              </li>
              <li>
                <h3 className="site-h3">Tú decides</h3>
                <p>Apruebas, editas o descartas. Hasta que no lo hagas, no se envía ni se modifica nada.</p>
              </li>
            </ol>
            <p className="mt-10">
              <Link href="/como-funciona" className="link">
                Ver el proceso completo →
              </Link>
            </p>
          </div>
        </section>

        {/* 4. Tres tareas ejemplo */}
        <section className="site-section" aria-labelledby="casos">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="casos" className="site-h2">
                Tareas que puedes dejar de hacer a mano
              </h2>
              <p className="site-lead">
                MarchaSolo las prepara con tus aplicaciones. Tú revisas y apruebas antes de que salgan.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {preview.map((c) => (
                <article key={c.id} className="flex flex-col gap-4">
                  <h3 className="site-h3">{c.title}</h3>
                  <CaseTrail item={c} short />
                  <p className="site-small m-0">{c.result}</p>
                </article>
              ))}
            </div>
            <p className="mt-10">
              <Link href="/casos-de-uso" className="link">
                Ver todos los casos de uso →
              </Link>
            </p>
          </div>
        </section>

        {/* 5. Bloque de control */}
        <section className="site-section is-navy" aria-labelledby="control">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="control" className="site-h2">
                No es un agente que actúa solo.
                <br />
                Es un compañero que espera tu visto bueno.
              </h2>
              <p className="site-lead">
                La automatización solo sirve si te fías de ella. Por eso, en MarchaSolo estas reglas no se pueden
                desactivar.
              </p>
            </div>
            <div className="trust">
              <div>
                <h3 className="site-h3">Nada sale sin tu aprobación</h3>
                <p>
                  Correos, mensajes, planillas, documentos, CRM y agenda esperan tu visto bueno. Solo los avisos para ti
                  van directos.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Tus claves, cifradas</h3>
                <p>
                  Las contraseñas y claves de tus servicios se guardan cifradas. Nadie puede volver a verlas, ni siquiera
                  tú.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Tus cuentas, tu factura</h3>
                <p>
                  Empiezas gratis con nuestra IA. Después usas tu propia IA: ves el costo estimado de cada tarea y puedes
                  poner un presupuesto.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Para quién es */}
        <section className="site-section is-white" aria-labelledby="para-quien">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="para-quien" className="site-h2">
                Para quien quiere ayuda sin soltar el control
              </h2>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">Profesionales independientes</h3>
                <p>
                  Atiendes clientes y haces el trabajo. MarchaSolo prepara lo repetitivo; tú decides qué se envía.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Pequeños equipos y agencias</h3>
                <p>Espacios compartidos con funciones: cada persona revisa y aprueba lo que le toca.</p>
              </li>
              <li>
                <h3 className="site-h3">Inmobiliarias y despachos</h3>
                <p>
                  Consultas por propiedades con la ficha de Tokko, vencimientos y documentos a partir de tus modelos. Con
                  Xubio, consulta si alguien ya es cliente.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* 7. CTA final */}
        <section className="site-section">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Cuéntanos qué te gustaría mejorar</h2>
                <p>
                  Empieza con una tarea concreta o pide ayuda para descubrirla. MarchaSolo te prepara la propuesta y la
                  pruebas gratis con nuestra IA. Tú decides si la pones en marcha.
                </p>
                <ul className="site-hero-note" style={{ marginTop: "0.75rem" }}>
                  <li>Sin tarjeta</li>
                  <li>Prueba gratis con nuestra IA</li>
                  <li>Nada se envía sin tu aprobación</li>
                </ul>
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
