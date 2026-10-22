import type { ReactNode } from "react"
import { Suspense } from "react"
import { LLM_PROVIDER_IDS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { DOC_MIMES, DriveCard, EXCEL_MIMES, FilesCard, SHEET_MIMES } from "./google-card"
import { GmailCard, TelegramCard } from "./inbox-cards"
import { LlmCard, type LlmConnection } from "./llm-card"
import { CalendarCard, HubSpotCard } from "./work-cards"

export const metadata = { title: "Integraciones" }

const CATEGORIES = [
  { id: "llms", label: "LLMs" },
  { id: "drives", label: "Drives" },
  { id: "comunicaciones", label: "Comunicaciones" },
  { id: "calculos", label: "Cálculos" },
  { id: "textos", label: "Textos" },
  { id: "bases-de-datos", label: "Bases de datos" },
  { id: "calendar", label: "Calendar" },
  { id: "crm", label: "CRM" },
]

export default function IntegrationsPage({ params, searchParams }: PageProps<"/w/[workspaceId]/integraciones">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Integraciones</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Las conexiones son de este espacio. Orkesta usa tu propia cuenta de cada servicio y no guarda tus datos más de lo necesario.
        </p>
      </div>
      <nav aria-label="Categorías" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="border border-rule bg-sheet px-3 py-1 text-sm text-ink hover:border-link">
            {c.label}
          </a>
        ))}
      </nav>
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <Integrations params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function Category({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <div className="mb-3 flex items-baseline gap-3 border-b border-rule pb-2">
        <h2 id={`${id}-title`} className="rotulo text-xl">
          {title}
        </h2>
        <p className="text-sm text-graphite">{description}</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">{children}</div>
    </section>
  )
}

// Integraciones previstas que aún no se pueden conectar.
function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="border border-dashed border-rule bg-sheet/60">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h3 className="rotulo text-lg text-graphite">{title}</h3>
          <p className="text-sm text-graphite">{description}</p>
        </div>
        <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Próximamente</span>
      </div>
    </section>
  )
}

async function Integrations({
  params,
  searchParams,
}: Pick<PageProps<"/w/[workspaceId]/integraciones">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const notice = sp.google === "conectado" ? "connected" : typeof sp.google_error === "string" ? sp.google_error : null
  const gmailNotice = sp.gmail === "conectado" ? "connected" : null
  const calendarNotice = sp.calendar === "conectado"
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/integraciones`)

  return (
    <div className="flex flex-col gap-10">
      <Category
        id="llms"
        title="LLMs"
        description="El modelo de IA que prepara y ejecuta tus automatizaciones, con tu propia clave. Puedes conectar varios y elegir cuál usa el espacio."
      >
        <LlmCards workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>

      <Category id="drives" title="Drives" description="Carpetas y archivos que Orkesta puede leer y donde puede guardar.">
        <DriveCard workspaceId={workspaceId} isAdmin={isAdmin} notice={notice} />
      </Category>

      <Category id="comunicaciones" title="Comunicaciones" description="Correo y mensajería: bandeja clasificada y envíos con tu aprobación.">
        <GmailCard workspaceId={workspaceId} isAdmin={isAdmin} notice={gmailNotice} />
        <TelegramCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <ComingSoon title="SMTP" description="Envía correo desde tu propio servidor o dominio (Outlook, IONOS, tu hosting…)." />
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
          description="Archivos .xlsx y .xls guardados en tu Google Drive."
          capability="Por ahora solo lectura. Para que Orkesta escriba en una planilla, usa Google Sheets."
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
        <ComingSoon title="Supabase" description="Consultar y actualizar tablas de tu propio proyecto de Supabase." />
      </Category>

      <Category id="calendar" title="Calendar" description="Tu agenda: consultar y proponer eventos.">
        <CalendarCard workspaceId={workspaceId} isAdmin={isAdmin} notice={calendarNotice} />
      </Category>

      <Category id="crm" title="CRM" description="Contactos, empresas y negocios de tu CRM.">
        <HubSpotCard workspaceId={workspaceId} isAdmin={isAdmin} />
      </Category>
    </div>
  )
}

async function LlmCards({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("ai_connections")
    .select("provider, model, key_hint, status, last_validated_at, is_default")
    .eq("workspace_id", workspaceId)
  const connections = (data ?? []) as LlmConnection[]
  return (
    <>
      {LLM_PROVIDER_IDS.map((provider) => (
        <LlmCard
          key={provider}
          workspaceId={workspaceId}
          provider={provider}
          connection={connections.find((c) => c.provider === provider)}
          isAdmin={isAdmin}
        />
      ))}
    </>
  )
}
