import Link from "next/link"
import type { ReactNode } from "react"
import { Suspense } from "react"
import { AI_PROVIDERS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { DOC_MIMES, DriveCard, EXCEL_MIMES, FilesCard, SHEET_MIMES } from "./google-card"
import { ImapCard, TelegramCard, WhatsAppCard } from "./inbox-cards"
import { AiCard } from "./ai-card"
import { RoutingCard } from "./routing-card"
import { BufferCard, CalendarCard, ContactsCard, HubSpotCard, TokkoCard, VoiceCard, VoiceHoursCard, VoiceWebCard, XubioCard } from "./work-cards"
import { ApiIntegrationCard } from "./api-integrations"
import { OnboardingReturn } from "../onboarding/onboarding-return"
import { HelpPanel, OpenCardFromQuery } from "@/components/help-panel"
import { HelpVoiceCard } from "./help-voice-card"
import { IntegrationExplorer } from "./integration-explorer"

export const metadata = { title: "Integraciones" }

const CATEGORIES = [
  { id: "asistente-voz", label: "Asistente de voz" },
  { id: "llms", label: "LLMs" },
  { id: "drives", label: "Drives" },
  { id: "comunicaciones", label: "Comunicaciones" },
  { id: "redes-sociales", label: "Redes sociales" },
  { id: "calculos", label: "Cálculos" },
  { id: "textos", label: "Textos" },
  { id: "bases-de-datos", label: "Bases de datos" },
  { id: "apis", label: "APIs a medida" },
  { id: "calendar", label: "Calendar" },
  { id: "crm", label: "CRM y contactos" },
  { id: "inmobiliaria", label: "Inmobiliaria" },
  { id: "contabilidad", label: "Contabilidad" },
]

export default function IntegrationsPage({ params, searchParams }: PageProps<"/w/[workspaceId]/integraciones">) {
  return (
    <div className="integration-page flex flex-col gap-6">
      <header className="integration-page-intro">
        <p className="app-eyebrow">CONECTA TU ESPACIO</p>
        <h1 className="rotulo">Conecta las aplicaciones de tu negocio</h1>
        <p className="integration-page-description">
          MarchaSolo utiliza tus propias cuentas para trabajar con tus herramientas. Tú controlas los permisos y las conexiones.
        </p>
        <Link href="onboarding" className="integration-setup-link">
          ¿No sabes por dónde empezar? Cuéntanos qué tarea quieres delegar
          <span aria-hidden="true">→</span>
        </Link>
      </header>
      <section className="integration-capabilities" aria-labelledby="integration-capabilities-title">
        <div className="integration-section-title">
          <p className="app-eyebrow">MENOS TAREAS REPETITIVAS</p>
          <h2 id="integration-capabilities-title">¿Qué quieres dejar en marcha?</h2>
        </div>
        <div className="integration-capability-grid">
          <article className="integration-capability">
            <span className="integration-capability-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v12H4zM8 21h8m-4-4v4M7 9h10m-10 4h6" />
              </svg>
            </span>
            <h3>Atiende y responde</h3>
            <p>Reúne mensajes y prepara respuestas para que las revises antes de enviarlas.</p>
          </article>
          <article className="integration-capability">
            <span className="integration-capability-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2" />
              </svg>
            </span>
            <h3>Organiza agenda y clientes</h3>
            <p>Consulta disponibilidad, prepara citas y mantén la información de tus clientes al día.</p>
          </article>
          <article className="integration-capability">
            <span className="integration-capability-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7m-7 4h7" />
              </svg>
            </span>
            <h3>Trabaja con tus documentos</h3>
            <p>Conecta tus archivos, planillas y herramientas para preparar el trabajo en un solo espacio.</p>
          </article>
        </div>
      </section>
      <IntegrationExplorer categories={CATEGORIES}>
        <Suspense fallback={<div className="integration-loading h-64 border border-rule bg-sheet" aria-busy="true" />}>
          <Integrations params={params} searchParams={searchParams} />
        </Suspense>
      </IntegrationExplorer>
    </div>
  )
}

function Category({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="integration-category scroll-mt-28">
      <div className="integration-category-heading">
        <h2 id={`${id}-title`} className="rotulo text-xl">
          {title}
        </h2>
        <p className="text-sm text-graphite">{description}</p>
      </div>
      <div className="integration-grid">{children}</div>
    </section>
  )
}

// Integraciones previstas que aún no se pueden conectar.
function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <details name="integrations" data-integration-status="catalog" data-integration-icon="outlook" className="integration-accordion border border-dashed border-rule bg-sheet/60">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg text-graphite">{title}</h3>
          <p className="text-sm text-graphite">{description}</p>
        </div>
        <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Próximamente</span>
      </summary>
    </details>
  )
}

async function Integrations({
  params,
  searchParams,
}: Pick<PageProps<"/w/[workspaceId]/integraciones">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const notice = sp.google === "conectado" ? "connected" : typeof sp.google_error === "string" ? sp.google_error : null
  const calendarNotice = sp.calendar === "conectado"
  const contactsNotice = sp.contacts === "conectado"
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/integraciones`)
  const supabase = await createClient()
  const { data: apiConnections } = await supabase.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["supabase", "custom_1", "custom_2"])
  const connection = (provider: string) => apiConnections?.find((item) => item.provider === provider) ?? null

  return (
    <div className="flex flex-col gap-10">
      <OnboardingReturn workspaceId={workspaceId} />
      <OpenCardFromQuery />
      <HelpPanel workspaceId={workspaceId} page="integraciones" />
      <Category
        id="asistente-voz"
        title="Asistente de voz"
        description="Atiende a tus clientes por voz, en tu web y por teléfono: reserva citas en tu horario, toma recados y responde con tus documentos. Cada conversación llega a la Bandeja."
      >
        <VoiceWebCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <VoiceCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <VoiceHoursCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <HelpVoiceCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>

      <Category
        id="llms"
        title="LLMs"
        description="La IA que prepara y ejecuta tus automatizaciones, con tu propia clave. Es lo primero que hay que conectar: sin ella MarchaSolo no puede trabajar. MarchaSolo elige el modelo de cada tarea según el modo y tu presupuesto (en «Cómo elige la IA»)."
      >
        {AI_PROVIDERS.map((p) => (
          <AiCard key={p.id} workspaceId={workspaceId} isAdmin={isAdmin} provider={p.id} />
        ))}
        <RoutingCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>

      <Category id="drives" title="Drives" description="Carpetas y archivos que MarchaSolo puede leer y donde puede guardar.">
        <DriveCard workspaceId={workspaceId} isAdmin={isAdmin} notice={notice} />
      </Category>

      <Category id="comunicaciones" title="Comunicaciones" description="Correo y mensajería: bandeja clasificada y envíos con tu aprobación.">
        <ImapCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <WhatsAppCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <TelegramCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <ComingSoon title="Outlook y Microsoft 365" description="Tu correo de Outlook o de Microsoft 365, con tu cuenta de Microsoft." />
      </Category>

      <Category id="redes-sociales" title="Redes sociales" description="Publicaciones en tus redes, redactadas por MarchaSolo y aprobadas por ti.">
        <BufferCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>


      <Category id="calculos" title="Cálculos" description="Planillas que las automatizaciones leen y actualizan.">
        <FilesCard
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          title="Google Sheets"
          description="Planillas de Google: leer rangos, añadir filas y actualizar celdas."
          capability="Lectura libre; las escrituras esperan tu aprobación."
          mimes={SHEET_MIMES}
          pickLabel="Elegir planillas"
        />
        <FilesCard
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          title="Excel"
          description="Archivos Excel guardados en tu Google Drive."
          capability="Leer hojas y rangos, añadir filas y actualizar celdas (.xlsx) con tu aprobación; Drive guarda la versión anterior. Los .xls antiguos y los libros con gráficos o tablas dinámicas, solo lectura."
          mimes={EXCEL_MIMES}
          pickLabel="Elegir archivos Excel"
        />
      </Category>

      <Category id="textos" title="Textos" description="Documentos que las automatizaciones leen, completan o crean.">
        <FilesCard
          workspaceId={workspaceId}
          isAdmin={isAdmin}
          title="Google Docs"
          description="Leer documentos, añadir texto al final y crear documentos nuevos."
          capability="Lectura libre; añadir o crear espera tu aprobación."
          mimes={DOC_MIMES}
          pickLabel="Elegir documentos"
        />
      </Category>

      <Category id="bases-de-datos" title="Bases de datos" description="Tablas de tus propias bases de datos.">
        <ApiIntegrationCard workspaceId={workspaceId} provider="supabase" connection={connection("supabase")} isAdmin={isAdmin} />
      </Category>

      <Category id="apis" title="APIs a medida" description="Conecta dos sistemas REST con sus propias credenciales. Las consultas leen datos; las escrituras esperan tu aprobación.">
        <ApiIntegrationCard workspaceId={workspaceId} provider="custom_1" connection={connection("custom_1")} isAdmin={isAdmin} />
        <ApiIntegrationCard workspaceId={workspaceId} provider="custom_2" connection={connection("custom_2")} isAdmin={isAdmin} />
      </Category>

      <Category id="calendar" title="Calendar" description="Tu agenda: consultar y proponer eventos.">
        <CalendarCard workspaceId={workspaceId} isAdmin={isAdmin} notice={calendarNotice} />
      </Category>

      <Category id="crm" title="CRM y contactos" description="Contactos, empresas y negocios de tu CRM o, si no usas uno, tus contactos de Google.">
        <HubSpotCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <ContactsCard workspaceId={workspaceId} isAdmin={isAdmin} notice={contactsNotice} />
      </Category>

      <Category id="inmobiliaria" title="Inmobiliaria" description="Tu cartera de propiedades: buscar fichas y registrar consultas.">
        <TokkoCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>

      <Category id="contabilidad" title="Contabilidad" description="Tus datos contables, para consultas, resúmenes y avisos.">
        <XubioCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>
    </div>
  )
}
