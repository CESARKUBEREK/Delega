import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Integraciones",
  description:
    "Conecta aplicaciones para compartir información, coordinar tareas y automatizar procesos del negocio con MarchaSolo.",
  path: "/integraciones",
})

type AppIcon = {
  id: string
  name: string
  logo?: string
  status?: "soon"
  note?: string
}

const GROUPS: { title: string; description: string; apps: AppIcon[] }[] = [
  {
    title: "Comunicación",
    description: "Centralizar conversaciones y correo electrónico para dar continuidad a cada consulta.",
    apps: [
      { id: "gmail", name: "Gmail", logo: "/brand/gmail.svg", note: "Con contraseña de aplicación" },
      { id: "imap", name: "Correo IMAP", note: "Configuración de servidor y cuenta" },
      { id: "whatsapp", name: "WhatsApp", logo: "/brand/whatsapp.svg" },
      { id: "telegram", name: "Telegram", logo: "/brand/telegram.svg" },
      { id: "outlook", name: "Outlook", logo: "/brand/microsoftoutlook.svg", status: "soon" },
    ],
  },
  {
    title: "Organización",
    description: "Coordinar agendas y mantener la información de contactos disponible.",
    apps: [
      { id: "calendar", name: "Google Calendar", logo: "/brand/googlecalendar.svg" },
      { id: "contacts", name: "Google Contacts" },
    ],
  },
  {
    title: "Documentos y hojas de cálculo",
    description: "Consultar, organizar y utilizar la información de los documentos del negocio.",
    apps: [
      { id: "drive", name: "Google Drive", logo: "/brand/googledrive.svg" },
      { id: "sheets", name: "Google Sheets", logo: "/brand/googlesheets.svg" },
      { id: "docs", name: "Google Docs", logo: "/brand/googledocs.svg" },
      { id: "excel", name: "Archivos Excel", note: "Formato de archivo compatible" },
    ],
  },
  {
    title: "Clientes y gestión",
    description: "Conectar la información comercial y operativa con los procesos cotidianos.",
    apps: [
      { id: "hubspot", name: "HubSpot", logo: "/brand/hubspot.svg" },
      { id: "tokko", name: "Tokko Broker", note: "Inmobiliarias" },
      { id: "xubio", name: "Xubio", note: "Contabilidad · solo lectura" },
    ],
  },
  {
    title: "Redes sociales",
    description: "Incorporar la gestión de publicaciones al trabajo coordinado.",
    apps: [{ id: "buffer", name: "Buffer" }],
  },
  {
    title: "Inteligencia artificial",
    description: "Elegir modelos de IA para interpretar solicitudes, analizar información y preparar resultados.",
    apps: [
      { id: "openai", name: "OpenAI", logo: "/brand/openai.svg" },
      { id: "anthropic", name: "Anthropic", logo: "/brand/anthropic.svg" },
      { id: "deepseek", name: "DeepSeek" },
      { id: "grok", name: "Grok", logo: "/brand/x.svg" },
    ],
  },
]

const STEPS = [
  {
    number: "01",
    title: "Llega una consulta",
    body: "Un mensaje o correo inicia el proceso.",
    app: "WhatsApp · Gmail",
  },
  {
    number: "02",
    title: "Se reúne el contexto",
    body: "Se consulta la información disponible del contacto y del negocio.",
    app: "CRM · Documentos",
  },
  {
    number: "03",
    title: "Se prepara el siguiente paso",
    body: "Se redacta una respuesta, se organiza un seguimiento o se prepara un documento.",
    app: "IA · Calendar · Docs",
  },
  {
    number: "04",
    title: "Se revisa y continúa",
    body: "Las acciones que requieren autorización quedan pendientes de aprobación.",
    app: "Control de MarchaSolo",
  },
]

export default function IntegrationsMarketingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
              Integraciones
            </p>
            <h1 className="site-h1">Las aplicaciones trabajan mejor cuando están conectadas.</h1>
            <p className="site-lead">
              MarchaSolo conecta las herramientas habituales del negocio para compartir información,
              coordinar tareas y automatizar procesos. Así, cada aplicación aporta lo que sabe hacer
              y el trabajo puede avanzar de una a otra.
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="connected-work">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="connected-work" className="site-h2">
                De aplicaciones aisladas a procesos conectados
              </h2>
              <p className="site-lead">
                Una consulta puede convertirse en un seguimiento completo: desde el primer mensaje
                hasta la preparación de una respuesta y el registro de la actividad.
              </p>
            </div>
            <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-rule bg-white p-5">
                  <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">
                    {step.number}
                  </span>
                  <h3 className="site-h3 mt-3">{step.title}</h3>
                  <p className="mt-2 text-sm text-graphite">{step.body}</p>
                  <p className="mt-4 border-t border-rule pt-3 text-xs font-semibold text-ink">
                    {step.app}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-graphite">
              El proceso y las aplicaciones utilizadas dependen de cada configuración. MarchaSolo
              prepara y coordina los pasos; las operaciones externas sujetas a autorización requieren
              aprobación antes de ejecutarse.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="apps">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="apps" className="site-h2">
                Aplicaciones y servicios
              </h2>
              <p className="site-lead">
                Un conjunto de herramientas para comunicación, organización, documentos, clientes e
                inteligencia artificial. La disponibilidad y el método de conexión pueden variar
                según la aplicación.
              </p>
            </div>

            <div className="space-y-10">
              {GROUPS.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <div className="mb-4">
                    <h3 className="site-h3">{group.title}</h3>
                    <p className="mt-1 text-sm text-graphite">{group.description}</p>
                  </div>
                  <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {group.apps.map((app) => (
                      <li
                        key={app.id}
                        className="flex items-center gap-3 rounded-2xl border border-rule bg-paper px-4 py-3"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rule bg-sheet p-2.5"
                          aria-hidden="true"
                        >
                          {app.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={app.logo}
                              alt=""
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-sm font-bold text-[var(--ms-navy)]">
                              {app.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold text-ink">{app.name}</span>
                          {app.status === "soon" ? (
                            <span className="text-xs text-graphite">Próximamente</span>
                          ) : (
                            <span className="text-xs text-graphite">
                              {app.note ?? "Disponible"}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="custom">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="custom" className="site-h2">
                Integraciones personalizadas
              </h2>
              <p className="site-lead">
                También es posible conectar sistemas internos y herramientas propias cuando el
                negocio necesita compartir información más allá de las aplicaciones habituales.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">APIs</h3>
                <p>Conexión con servicios y sistemas mediante APIs REST, con credenciales propias.</p>
              </li>
              <li>
                <h3 className="site-h3">Bases de datos</h3>
                <p>Consulta de datos de negocio para aportar contexto a respuestas y automatizaciones.</p>
              </li>
              <li>
                <h3 className="site-h3">Flujos a medida</h3>
                <p>Coordinación de pasos y traspaso a una persona cuando el proceso requiere revisión.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="control">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="control" className="site-h2">
                Conexiones bajo control
              </h2>
              <p className="site-lead">
                Conectar aplicaciones no significa darles acceso ilimitado. Cada automatización
                utiliza solo las herramientas que necesita. Las credenciales se almacenan cifradas
                y las operaciones externas que requieren autorización quedan sujetas a aprobación,
                salvo las excepciones configuradas.
              </p>
            </div>
            <p className="text-sm text-graphite">
              Algunas conexiones utilizan autorización de Google; Gmail puede configurarse mediante
              contraseña de aplicación. Outlook todavía no está disponible y se identifica como
              próximamente.
            </p>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Conectar solo lo necesario</h2>
                <p>
                  Cada proceso utiliza las aplicaciones que necesita. Es posible comenzar con pocas
                  herramientas y sumar otras a medida que surjan nuevas necesidades.
                </p>
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
