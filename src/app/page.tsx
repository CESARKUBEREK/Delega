import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { AppPreview, GuaranteeStrip } from "@/components/site/app-preview"
import { TOOL_GROUPS, USE_CASES } from "@/lib/site-content"

export const metadata: Metadata = {
  title: { absolute: "MarchaSolo · Tu negocio, en automático" },
  description:
    "MarchaSolo automatiza las tareas de tu negocio, conecta tus aplicaciones y trabaja por ti. Las tareas avanzan; tú decides antes de que se envíe nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
}

// Portada pública, también con sesión (el logo de la app lleva aquí); la
// cabecera cambia «Entrar» por «Ir a mi espacio».
export default function HomePage() {
  const preview = USE_CASES.filter((c) => ["correo", "planillas", "reuniones"].includes(c.id))
  return (
    <MarketingLayout>
      <main>
        <section className="site-hero">
          <div className="site-container site-hero-grid">
            <div>
              <h1 className="site-display">Las tareas avanzan. Tú decides.</h1>
              <p className="site-lead">
                MarchaSolo automatiza las tareas de tu negocio, conecta tus aplicaciones y trabaja por ti. Tú mantienes el control.
              </p>
              <div className="site-actions">
                <Link href="/crear-cuenta" className="btn btn-primary">
                  Probar MarchaSolo
                </Link>
                <Link href="/como-funciona" className="btn btn-secondary">
                  Ver cómo funciona
                </Link>
              </div>
              <ul className="site-hero-note">
                <li>Crear la cuenta no cuesta nada</li>
                <li>Nada se envía sin tu aprobación</li>
              </ul>
            </div>
            <AppPreview />
          </div>
        </section>
        <GuaranteeStrip />

        <section className="site-section is-white" aria-labelledby="pasos">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="pasos" className="site-h2">Así de simple</h2>
              <p className="site-lead">Lo explicas como se lo explicarías a alguien de tu equipo. Sin diagramas ni fórmulas.</p>
            </div>
            <ol className="steps">
              <li>
                <h3 className="site-h3">Dile qué necesitas</h3>
                <p>Escribe o dicta la tarea con tus palabras: qué tiene que pasar, cuándo y con qué datos.</p>
              </li>
              <li>
                <h3 className="site-h3">MarchaSolo hace el trabajo</h3>
                <p>Prepara los pasos, consulta tus aplicaciones y redacta lo necesario, en el momento que elijas o cuando llegue un mensaje.</p>
              </li>
              <li>
                <h3 className="site-h3">Tú decides</h3>
                <p>Antes de enviar un correo, escribir en una planilla o tocar tu agenda, te lo enseña. Apruebas, editas o lo descartas.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="site-section" aria-labelledby="resultados">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="resultados" className="site-h2">Lo que cambia en tu día</h2>
            </div>
            <div className="outcomes">
              <div className="outcome">
                <h3 className="site-h3">Abres la bandeja y ya está ordenada</h3>
                <p>Lo que espera respuesta, arriba. Los boletines y avisos, apartados. Las respuestas urgentes, preparadas.</p>
              </div>
              <div className="outcome">
                <h3 className="site-h3">Las rutinas se hacen solas</h3>
                <p>El resumen de la mañana, la agenda de mañana o el informe del viernes llegan a su hora, a tu móvil o a tu correo.</p>
              </div>
              <div className="outcome">
                <h3 className="site-h3">Tus datos, al día sin copiarlos</h3>
                <p>Planillas, CRM y documentos se actualizan a partir de correos, mensajes y archivos, siempre con tu visto bueno.</p>
              </div>
              <div className="outcome">
                <h3 className="site-h3">Cada decisión sigue siendo tuya</h3>
                <p>Ves exactamente qué se va a enviar o cambiar antes de que pase, y puedes aprobarlo desde el móvil.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="casos">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="casos" className="site-h2">Tareas que puedes delegar desde el primer día</h2>
              <p className="site-lead">Ejemplos reales de lo que MarchaSolo hace hoy con las aplicaciones que ya usas.</p>
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
                Ver todos los casos de uso
              </Link>
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="conexiones">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="conexiones" className="site-h2">Trabaja con lo que ya usas</h2>
              <p className="site-lead">
                Conectas tus propias cuentas, solo las que necesites. Para la IA eliges proveedor y MarchaSolo usa en cada tarea el modelo
                adecuado: uno económico para lo sencillo y el mejor cuando hace falta, dentro del presupuesto que marques.
              </p>
            </div>
            <dl className="tools">
              {TOOL_GROUPS.map((g) => (
                <div key={g.title}>
                  <dt>{g.title}</dt>
                  <dd>
                    {g.tools.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="site-section is-navy" aria-labelledby="control">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="control" className="site-h2">Tú mantienes el control. MarchaSolo hace el trabajo.</h2>
              <p className="site-lead">La automatización solo es útil si te fías de ella. Por eso estas reglas no se pueden desactivar.</p>
            </div>
            <div className="trust">
              <div>
                <h3 className="site-h3">Nada sale sin tu aprobación</h3>
                <p>
                  Correos, mensajes, planillas, documentos, CRM y agenda esperan tu visto bueno. Solo los avisos para ti, y las citas dentro del
                  horario que tú fijes si lo activas, van directos.
                </p>
              </div>
              <div>
                <h3 className="site-h3">Tus claves, cifradas</h3>
                <p>Las contraseñas y claves de tus servicios se guardan cifradas. Nadie puede volver a verlas, ni siquiera tú.</p>
              </div>
              <div>
                <h3 className="site-h3">Tus cuentas, tu factura</h3>
                <p>Usas tus propias cuentas y tu propia IA. Ves el coste estimado de cada tarea y puedes poner un presupuesto.</p>
              </div>
              <div>
                <h3 className="site-h3">Avisos sin datos de clientes</h3>
                <p>Las notificaciones del móvil dicen qué espera tu revisión, no lo que contiene.</p>
              </div>
              <div>
                <h3 className="site-h3">Las aprobaciones nunca por voz</h3>
                <p>Puedes dictar y hablar con MarchaSolo, pero aprobar siempre es un botón que pulsas tú.</p>
              </div>
              <div>
                <h3 className="site-h3">Cada espacio, separado</h3>
                <p>Los datos de cada espacio de trabajo están aislados, y quien administra decide quién ve la bandeja.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="para-quien">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="para-quien" className="site-h2">Para quien lleva un negocio sin un equipo detrás</h2>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">Autónomos</h3>
                <p>Atiendes clientes, facturas y haces el trabajo. MarchaSolo se queda con lo repetitivo.</p>
              </li>
              <li>
                <h3 className="site-h3">Profesionales</h3>
                <p>Despachos, consultas y clínicas con citas, consultas y seguimientos que no esperan.</p>
              </li>
              <li>
                <h3 className="site-h3">Microempresas</h3>
                <p>Inmobiliarias y pequeños negocios con muchos mensajes y poco tiempo para ordenarlos.</p>
              </li>
              <li>
                <h3 className="site-h3">Pequeños equipos</h3>
                <p>Espacios compartidos con funciones: cada persona ve y aprueba lo que le toca.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Cuéntale una tarea que te quite tiempo</h2>
                <p>Al crear la cuenta te pedimos solo eso. MarchaSolo te prepara el plan antes de que conectes nada.</p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Probar MarchaSolo
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
