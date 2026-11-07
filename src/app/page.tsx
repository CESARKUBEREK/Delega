import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { AppPreview, GuaranteeStrip } from "@/components/site/app-preview"
import { publicPageMetadata } from "@/lib/seo"
import { USE_CASES } from "@/lib/site-content"

export const metadata = publicPageMetadata({
  title: "Tu negocio, en automático",
  absoluteTitle: "MarchaSolo · Tu negocio, en automático",
  description:
    "Un compañero de trabajo con IA: conecta tus aplicaciones, prepara lo que hay que hacer y se detiene antes de enviar o cambiar nada. Tú revisas y das el visto bueno.",
  path: "/",
})

// Portada pública, también con sesión (el logo de la app lleva aquí); la
// cabecera cambia «Entrar» por «Ir a mi espacio».
export default function HomePage() {
  const preview = USE_CASES.filter((c) =>
    ["whatsapp-negocio", "voz-reservas", "leads"].includes(c.id)
  )
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
                Cuéntale qué te gustaría mejorar. Si aún no lo tienes claro, MarchaSolo te ayuda a descubrirlo y prepara
                el trabajo. Tú revisas antes de enviar o cambiar nada.
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
                <li>Crear la cuenta es gratis</li>
                <li>Tú apruebas antes de enviar</li>
                <li>Prueba gratis con nuestra IA</li>
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
                <h3 className="site-h3">Dile qué necesitas</h3>
                <p>Escribes o dictas lo que quieres mejorar con tus palabras, como se lo explicarías a un compañero.</p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo prepara el trabajo</h3>
                <p>Organiza los pasos, consulta tus apps y deja listo el borrador o el cambio.</p>
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
                  Usas tus propias cuentas y tu propia IA. Ves el costo estimado de cada tarea y puedes poner un
                  presupuesto.
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
                <h3 className="site-h3">Freelancers y autónomos</h3>
                <p>
                  Atiendes clientes y haces el trabajo. MarchaSolo prepara lo repetitivo; tú decides qué se envía.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Pequeños equipos y agencias</h3>
                <p>Espacios compartidos con funciones: cada persona revisa y aprueba lo que le toca.</p>
              </li>
              <li>
                <h3 className="site-h3">Negocios de correo, citas y planillas</h3>
                <p>
                  Inmobiliarias, despachos y negocios con muchos mensajes: el trabajo avanza, pero nada sale sin revisión.
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
                  Puedes empezar con una tarea concreta o pedir ayuda para descubrir oportunidades. MarchaSolo prepara
                  una propuesta antes de que conectes tus aplicaciones. Tú decides si la pones en marcha.
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
