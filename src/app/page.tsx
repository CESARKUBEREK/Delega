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
    "Un asistente de IA que conecta aplicaciones, organiza tareas y prepara respuestas y seguimientos para el negocio. Prueba gratuita, sin tarjeta.",
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
              <p className="site-kicker site-hero-kicker">ASISTENTE DE IA PARA EL NEGOCIO</p>
              <h1 className="site-display">
                El trabajo del negocio, en marcha.
                <span>Menos tareas manuales. Más tiempo para avanzar.</span>
              </h1>
              <p className="site-lead site-hero-lead">
                Conecta las aplicaciones, organiza tareas y prepara respuestas y seguimientos. Las acciones que requieren autorización quedan pendientes de revisión.
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
                <li>Primeros pasos sin conectar una IA propia</li>
                <li>Control sobre las acciones externas</li>
              </ul>
            </div>
            <div className="site-hero-preview">
              <AppPreview />
              <p className="site-preview-caption">
                <span aria-hidden="true">✓</span>
                La respuesta queda lista para revisión.
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
                La tarea se describe en lenguaje cotidiano. MarchaSolo organiza el proceso y prepara el trabajo para su revisión.
              </p>
            </div>
            <ol className="steps">
              <li>
                <h3 className="site-h3">Describe la tarea</h3>
                <p>Selecciona un ejemplo o describe la tarea en lenguaje cotidiano. La propuesta estará lista en unos segundos.</p>
              </li>
              <li>
                <h3 className="site-h3">Prueba gratuita con correo</h3>
                <p>Con nuestra IA, gratis: ordena tu bandeja y deja las respuestas preparadas desde el primer día.</p>
              </li>
              <li>
                <h3 className="site-h3">Revisa el resultado</h3>
                <p>Las acciones que requieren autorización se pueden revisar, editar o descartar antes de ejecutarse.</p>
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
                Tareas que MarchaSolo puede automatizar
              </h2>
              <p className="site-lead">
                MarchaSolo prepara estas tareas con las aplicaciones conectadas. Las acciones sujetas a aprobación esperan revisión.
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
                IA que trabaja con supervisión y control.
              </h2>
              <p className="site-lead">
                La automatización debe ser útil y transparente. MarchaSolo permite revisar las acciones que requieren autorización.
              </p>
            </div>
            <div className="trust">
              <div>
                <h3 className="site-h3">Control sobre las acciones</h3>
                <p>
                  Las acciones externas sujetas a aprobación —como enviar mensajes o modificar registros— quedan pendientes de revisión. Los avisos internos pueden entregarse directamente.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Tus claves, cifradas</h3>
                <p>
                  Las contraseñas y claves de tus servicios se guardan cifradas. Las credenciales se almacenan cifradas y no se muestran nuevamente.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Tus cuentas, tu factura</h3>
                <p>
                  La prueba inicial utiliza la IA de MarchaSolo. Después se conecta una cuenta propia de IA; el panel muestra el costo estimado de cada tarea y permite fijar un presupuesto.
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
                  La atención al cliente y el trabajo diario ocupan la jornada. MarchaSolo prepara las tareas repetitivas y facilita su revisión.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Pequeños equipos y agencias</h3>
                <p>Espacios compartidos y funciones para que cada integrante revise las tareas que le corresponden.</p>
              </li>
              <li>
                <h3 className="site-h3">Inmobiliarias y despachos</h3>
                <p>
                  Consultas sobre propiedades con la ficha de Tokko, avisos de vencimientos y documentos preparados a partir de modelos. Xubio permite consultar si un contacto ya es cliente.
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
                <h2 className="site-h2">Identifica qué conviene mejorar</h2>
                <p>
                  Empieza con una tarea concreta o identifica oportunidades de mejora. MarchaSolo prepara una propuesta para probarla gratis con su IA.
                </p>
                <ul className="site-hero-note" style={{ marginTop: "0.75rem" }}>
                  <li>Sin tarjeta</li>
                  <li>Prueba gratis con nuestra IA</li>
                  <li>Revisión de acciones que requieren autorización</li>
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
