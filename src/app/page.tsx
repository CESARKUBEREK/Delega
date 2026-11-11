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
    "Un asistente de IA que conecta aplicaciones, coordina tareas y automatiza el trabajo cotidiano. Menos tareas manuales y más tiempo para el negocio.",
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
              <p className="site-kicker site-hero-kicker">MARCHASOLO · AUTOMATIZACIÓN CON IA</p>
              <h1 className="site-display">
                El negocio sigue en marcha. El trabajo también.
                <span>Menos tareas manuales. Más tiempo para hacer crecer el negocio.</span>
              </h1>
              <p className="site-lead site-hero-lead">
                Un asistente de IA que conecta aplicaciones, coordina tareas y automatiza el trabajo cotidiano. MarchaSolo organiza procesos de principio a fin, consulta información, prepara respuestas y ejecuta las acciones permitidas. Las operaciones que requieren autorización quedan pendientes de aprobación.
              </p>
              <div className="site-actions">
                <Link href="/crear-cuenta" className="btn btn-primary">
                  Crear cuenta gratis
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
                Cada paso, visible. Control y aprobación en manos del usuario.
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
                Un solo lugar para coordinar el trabajo
              </h2>
              <p className="site-lead">
                Indicar el resultado esperado. MarchaSolo organiza los pasos, utiliza las aplicaciones conectadas y muestra el avance del proceso.
              </p>
            </div>
            <ol className="steps">
              <li>
                <h3 className="site-h3">Describir la tarea</h3>
                <p>Indicar el resultado esperado o seleccionar un ejemplo. MarchaSolo interpreta la solicitud y propone cómo organizar el trabajo.</p>
              </li>
              <li>
                <h3 className="site-h3">Conectar las aplicaciones necesarias</h3>
                <p>Conectar únicamente las herramientas necesarias para cada proceso: correo electrónico, calendario, archivos, mensajería o CRM.</p>
              </li>
              <li>
                <h3 className="site-h3">Supervisión y aprobación</h3>
                <p>El avance y los resultados quedan visibles. Las acciones que requieren autorización pueden editarse, aprobarse o descartarse antes de ejecutarse.</p>
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
                Todo el trabajo que puede automatizarse
              </h2>
              <p className="site-lead">
                Desde una consulta inicial hasta el seguimiento: MarchaSolo conecta los pasos y las aplicaciones necesarias. Las acciones sujetas a aprobación quedan pendientes de revisión.
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
                La inteligencia artificial trabaja. El usuario mantiene el control.
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
                <h3 className="site-h3">Credenciales cifradas</h3>
                <p>
                  Las contraseñas y claves de los servicios conectados se almacenan cifradas y no se muestran nuevamente.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Consumo de IA transparente</h3>
                <p>
                  La prueba inicial utiliza la IA de MarchaSolo. Después es posible conectar una cuenta propia de IA; el panel muestra el costo estimado de cada tarea y permite establecer un presupuesto.
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
                Más capacidad operativa para profesionales y pequeños negocios.
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
                <h2 className="site-h2">El próximo paso: automatizar el trabajo cotidiano</h2>
                <p>
                  Seleccionar un proceso que consume tiempo. MarchaSolo ayuda a organizarlo y probar su funcionamiento con las aplicaciones disponibles.
                </p>
                <ul className="site-hero-note" style={{ marginTop: "0.75rem" }}>
                  <li>Sin tarjeta</li>
                  <li>Prueba gratis con nuestra IA</li>
                  <li>Revisión de acciones que requieren autorización</li>
                </ul>
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
