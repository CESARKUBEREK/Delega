import Link from "next/link"
import type { ReactNode } from "react"
import { Suspense } from "react"
import { AI_PROVIDERS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { DOC_MIMES, DriveCard, EXCEL_MIMES, FilesCard, SHEET_MIMES } from "./google-card"
import { ImapCard, TelegramCard, WhatsAppCard } from "./inbox-cards"
import { AiCard } from "./ai-card"
import { BufferCard, CalendarCard, HubSpotCard, TokkoCard, XubioCard } from "./work-cards"
import { ApiIntegrationCard } from "./api-integrations"

export const metadata = { title: "Integraciones" }

const CATEGORIES = [
  { id: "llms", label: "LLMs" },
  { id: "drives", label: "Drives" },
  { id: "comunicaciones", label: "Comunicaciones" },
  { id: "redes-sociales", label: "Redes sociales" },
  { id: "telefono", label: "Atención telefónica" },
  { id: "calculos", label: "Cálculos" },
  { id: "textos", label: "Textos" },
  { id: "bases-de-datos", label: "Bases de datos" },
  { id: "apis", label: "APIs a medida" },
  { id: "calendar", label: "Calendar" },
  { id: "crm", label: "CRM" },
  { id: "inmobiliaria", label: "Inmobiliaria" },
  { id: "contabilidad", label: "Contabilidad" },
]

export default function IntegrationsPage({ params, searchParams }: PageProps<"/w/[workspaceId]/integraciones">) {
  return (
    <div className="flex flex-col gap-6">
      <header className="integration-page-intro">
        <p className="app-eyebrow">CONECTA TU ESPACIO</p>
        <h1 className="rotulo text-2xl">Integraciones</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Las conexiones son de este espacio. MarchaSolo usa tu propia cuenta de cada servicio y no guarda tus datos más de lo necesario.
        </p>
        <p className="mt-2 text-sm">
          ¿Prefieres ir paso a paso?{" "}
          <Link href="bienvenida" className="font-semibold text-link underline underline-offset-4">
            Abre el asistente de configuración
          </Link>
        </p>
      </header>
      <nav aria-label="Categorías de integraciones" className="integration-category-nav">
        <span className="integration-category-nav-label">EXPLORA POR CATEGORÍA</span>
        <div className="integration-category-links">
          {CATEGORIES.map((c, index) => (
            <a key={c.id} href={`#${c.id}`} className="integration-category-link">
              <span className="integration-category-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {c.label}
            </a>
          ))}
        </div>
      </nav>
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <Integrations params={params} searchParams={searchParams} />
      </Suspense>
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
    <details name="integrations" className="integration-accordion border border-dashed border-rule bg-sheet/60">
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
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/integraciones`)
  const supabase = await createClient()
  const { data: apiConnections } = await supabase.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["supabase", "custom_1", "custom_2"])
  const connection = (provider: string) => apiConnections?.find((item) => item.provider === provider) ?? null

  return (
    <div className="flex flex-col gap-10">
      <Category id="llms" title="LLMs" description="La IA que prepara y ejecuta tus automatizaciones, con tu propia clave. La principal la usan el asistente y la bandeja; cada automatización puede usar otra.">
        {AI_PROVIDERS.map((p) => (
          <AiCard key={p.id} workspaceId={workspaceId} isAdmin={isAdmin} provider={p.id} />
        ))}
        <ComingSoon title="Kimi" description="Modelos Kimi de Moonshot AI con tu propia clave de API." />
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

      <Category id="telefono" title="Atención telefónica" description="Un agente de voz que atiende las llamadas de tu negocio.">
        <ComingSoon title="Grok Voice" description="Atiende llamadas con la voz de Grok (xAI): responde dudas, toma datos y deja la cita o el aviso en MarchaSolo." />
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

      <Category id="crm" title="CRM" description="Contactos, empresas y negocios de tu CRM.">
        <HubSpotCard workspaceId={workspaceId} isAdmin={isAdmin} />
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
