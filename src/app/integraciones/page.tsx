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
  mark: string
  tone: string
  status?: "soon"
}

const APPS: AppIcon[] = [
  { id: "gmail", name: "Gmail", mark: "Gm", tone: "#EA4335" },
  { id: "calendar", name: "Google Calendar", mark: "Cal", tone: "#4285F4" },
  { id: "drive", name: "Google Drive", mark: "Dr", tone: "#0F9D58" },
  { id: "whatsapp", name: "WhatsApp", mark: "Wa", tone: "#25D366" },
  { id: "telegram", name: "Telegram", mark: "Tg", tone: "#229ED9" },
  { id: "hubspot", name: "HubSpot", mark: "Hs", tone: "#FF7A59" },
  { id: "sheets", name: "Google Sheets", mark: "Sh", tone: "#0F9D58" },
  { id: "docs", name: "Google Docs", mark: "Do", tone: "#4285F4" },
  { id: "outlook", name: "Outlook", mark: "Ou", tone: "#0078D4", status: "soon" },
  { id: "openai", name: "OpenAI", mark: "AI", tone: "#10A37F" },
  { id: "anthropic", name: "Anthropic", mark: "An", tone: "#D4A27C" },
  { id: "grok", name: "Grok", mark: "X", tone: "#111111" },
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

            <ul
              className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {APPS.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--ms-rule,rgba(15,23,42,0.08))] bg-[var(--ms-paper,#fff)] px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                    style={{ background: app.tone }}
                  >
                    {app.mark}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold text-[var(--ms-navy,#0f172a)]">{app.name}</span>
                    {app.status === "soon" ? (
                      <span className="text-xs text-[var(--ms-muted,#64748b)]">Próximamente</span>
                    ) : (
                      <span className="text-xs text-[var(--ms-muted,#64748b)]">Disponible</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-[var(--ms-muted)]">
              También: Telegram, HubSpot, Google Contacts, Tokko Broker, Xubio (lectura), Buffer, asistente de voz en web
              y teléfono, y APIs a medida.
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
                <p>Dos conectores personalizados por espacio, con tus credenciales. Lecturas libres; escrituras con aprobación.</p>
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
