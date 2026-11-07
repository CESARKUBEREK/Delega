import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Integraciones",
  description:
    "Conecta Gmail, Google Calendar, WhatsApp, Google Drive y más. MarchaSolo dispara flujos, agenda seguimientos y prepara confirmaciones; tú apruebas antes de enviar.",
  path: "/integraciones",
})

type AppIcon = {
  id: string
  name: string
  /** Ruta en /public/brand */
  logo: string
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
  { id: "hubspot", name: "HubSpot", logo: "/brand/hubspot.svg" },
  { id: "sheets", name: "Google Sheets", logo: "/brand/googlesheets.svg" },
  { id: "docs", name: "Google Docs", logo: "/brand/googledocs.svg" },
  { id: "outlook", name: "Outlook", logo: "/brand/microsoftoutlook.svg", status: "soon" },
  { id: "openai", name: "OpenAI", logo: "/brand/openai.svg" },
  { id: "anthropic", name: "Anthropic", logo: "/brand/anthropic.svg" },
  { id: "grok", name: "Grok", logo: "/brand/x.svg" },
]

const CAPABILITIES = [
  {
    title: "Dispara flujos en el momento",
    body: "Cuando llega un correo, un WhatsApp o una cita, MarchaSolo prepara la respuesta, el seguimiento o la confirmación. Tú das el visto bueno antes de que salga.",
  },
  {
    title: "Agenda seguimientos y recordatorios",
    body: "Programa toques a clientes, resúmenes y tareas repetidas. Usa tu calendario real: propone huecos y deja listo el mensaje.",
  },
  {
    title: "Confirma sin soltar el control",
    body: "Envíos, cambios en planillas, CRM o agenda esperan tu aprobación. Si hace falta una persona, MarchaSolo te lo pasa.",
  },
  {
    title: "Conecta tus sistemas internos",
    body: "APIs REST y bases propias para enlazar CRM, inventarios o herramientas a medida. Las escrituras también pasan por tu aprobación.",
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
              Conecta tus aplicaciones: Gmail, Google Calendar, Outlook, WhatsApp, Google Drive y más. MarchaSolo
              dispara flujos, agenda seguimientos y prepara confirmaciones al momento — siempre con tu aprobación antes
              de enviar.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="apps">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="apps" className="site-h2">
                Las apps de tu día a día
              </h2>
              <p className="site-lead">
                Conectas solo lo que pide cada tarea. MarchaSolo usa tu cuenta en cada servicio; las claves se guardan
                cifradas.
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={app.logo}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
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
                Integra herramientas propias, bases de datos, CRM internos o flujos a medida. Conecta tus APIs: cuando
                una acción necesita a una persona, MarchaSolo te la entrega para que decidas.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">APIs REST a medida</h3>
                <p>
                  Dos conectores personalizados por espacio, con tus credenciales. Lecturas libres; escrituras con
                  aprobación.
                </p>
              </li>
              <li>
                <h3 className="site-h3">Bases de datos</h3>
                <p>Consulta tablas propias (por ejemplo Supabase) para enriquecer respuestas y automatizaciones.</p>
              </li>
              <li>
                <h3 className="site-h3">Traspaso a una persona</h3>
                <p>
                  Si el caso se sale del guion, MarchaSolo prepara el contexto y te lo deja en la bandeja o en una
                  aprobación: no improvisa en tu nombre.
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
                  Cuéntale una tarea. MarchaSolo te dice qué aplicaciones hacen falta y te guía para conectarlas. Nada se
                  envía sin tu aprobación.
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
