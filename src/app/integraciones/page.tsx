import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Integraciones",
  description:
    "Conecta Gmail, Google Calendar, WhatsApp, Google Drive y más. MarchaSolo organiza tareas, prepara seguimientos y facilita la revisión de acciones.",
  path: "/integraciones",
})

type AppIcon = {
  id: string
  name: string
  /** Ruta en /public/brand. Sin logotipo, se muestran las iniciales. */
  logo?: string
  status?: "soon"
  /** Aclaración corta bajo el nombre (p. ej. cómo se conecta). */
  note?: string
}

const APPS: AppIcon[] = [
  { id: "gmail", name: "Gmail", logo: "/brand/gmail.svg", note: "Con contraseña de aplicación" },
  { id: "calendar", name: "Google Calendar", logo: "/brand/googlecalendar.svg" },
  { id: "drive", name: "Google Drive", logo: "/brand/googledrive.svg" },
  { id: "whatsapp", name: "WhatsApp", logo: "/brand/whatsapp.svg" },
  { id: "telegram", name: "Telegram", logo: "/brand/telegram.svg" },
  { id: "tokko", name: "Tokko Broker", note: "Inmobiliarias" },
  { id: "xubio", name: "Xubio", note: "Contabilidad, solo lectura" },
  { id: "hubspot", name: "HubSpot", logo: "/brand/hubspot.svg" },
  { id: "sheets", name: "Google Sheets", logo: "/brand/googlesheets.svg" },
  { id: "docs", name: "Google Docs", logo: "/brand/googledocs.svg" },
  { id: "outlook", name: "Outlook", logo: "/brand/microsoftoutlook.svg", status: "soon" },
  { id: "openai", name: "OpenAI", logo: "/brand/openai.svg" },
  { id: "anthropic", name: "Anthropic", logo: "/brand/anthropic.svg" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "grok", name: "Grok", logo: "/brand/x.svg" },
]

const CAPABILITIES = [
  {
    title: "Dispara flujos en el momento",
    body: "Cuando llega un correo, un mensaje o una cita, MarchaSolo prepara la respuesta, el seguimiento o la confirmación para su revisión.",
  },
  {
    title: "Agenda seguimientos y recordatorios",
    body: "Programa seguimientos, resúmenes y tareas recurrentes. Consulta el calendario conectado, identifica horarios disponibles y prepara el mensaje.",
  },
  {
    title: "Confirma sin soltar el control",
    body: "Los envíos y cambios sujetos a autorización en hojas de cálculo, CRM o agenda quedan pendientes de revisión. Si hace falta intervención humana, MarchaSolo deriva el caso.",
  },
  {
    title: "Conecta tus sistemas internos",
    body: "APIs REST y bases de datos propias permiten enlazar CRM, inventarios y herramientas a medida. Las operaciones de escritura requieren la autorización configurada.",
  },
]

export default function IntegrationsMarketingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Integraciones</h1>
            <p className="site-lead">
              Conecta las aplicaciones disponibles, como Gmail, Google Calendar, WhatsApp y Google Drive. Outlook se incorporará próximamente. MarchaSolo organiza tareas, prepara seguimientos y deja las acciones sujetas a autorización pendientes de revisión.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="apps">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="apps" className="site-h2">
                Aplicaciones para el trabajo diario
              </h2>
              <p className="site-lead">
                Solo se conectan las aplicaciones necesarias para cada tarea. MarchaSolo utiliza las cuentas autorizadas y almacena las credenciales cifradas.
              </p>
            </div>

            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {APPS.map((app) => (
                <li key={app.id} className="flex items-center gap-3 rounded-2xl border border-rule bg-paper px-4 py-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rule bg-sheet p-2.5"
                    aria-hidden="true"
                  >
                    {/* Logos en /public/brand (mismo origen: pasan el CSP). */}
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
                        {app.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold text-ink">{app.name}</span>
                    {app.status === "soon" ? (
                      <span className="text-xs text-graphite">Próximamente</span>
                    ) : (
                      <span className="text-xs text-graphite">{app.note ?? "Disponible"}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-graphite">
              También: Google Contacts, Tokko Broker, Xubio (lectura), Buffer, asistente de voz en web y teléfono, y APIs
              a medida.
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="cap">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="cap" className="site-h2">
                Qué hace con tus aplicaciones
              </h2>
            </div>
            <div className="facts">
              {CAPABILITIES.map((c) => (
                <div key={c.title} className="fact">
                  <h3 className="site-h3">{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="custom">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="custom" className="site-h2">
                Sistemas internos y APIs
              </h2>
              <p className="site-lead">
                Integra herramientas propias, bases de datos, CRM internos y flujos a medida. Cuando una acción requiere intervención humana, MarchaSolo deriva el caso para su revisión.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">APIs REST a medida</h3>
                <p>
                  Dos conectores personalizados por espacio, con credenciales propias. Las lecturas están disponibles; las escrituras requieren aprobación.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Bases de datos</h3>
                <p>Consulta tablas propias (por ejemplo, Supabase) para aportar contexto a respuestas y automatizaciones.</p>
              </li>
              <li>
                <h3 className="site-h3">Traspaso a una persona</h3>
                <p>
                  Si el caso requiere atención humana, MarchaSolo prepara el contexto y lo deriva a la bandeja o al flujo de aprobación.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza por una sola conexión</h2>
                <p>
                  Describe una tarea. MarchaSolo identifica las aplicaciones necesarias y guía el proceso de conexión. Las acciones sujetas a aprobación quedan pendientes hasta su revisión.
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
