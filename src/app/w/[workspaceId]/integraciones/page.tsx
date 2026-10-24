import type { ReactNode } from "react"
import { Suspense } from "react"
import { OPENAI_MODELS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { DOC_MIMES, DriveCard, EXCEL_MIMES, FilesCard, SHEET_MIMES } from "./google-card"
import { GmailCard, ImapCard, TelegramCard } from "./inbox-cards"
import { ConnectKeyForm, DisconnectForm, ModelForm } from "./openai-forms"
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
      <Category id="llms" title="LLMs" description="El modelo de IA que prepara y ejecuta tus automatizaciones, con tu propia clave.">
        <OpenAICard workspaceId={workspaceId} isAdmin={isAdmin} />
        <ComingSoon title="Anthropic" description="Modelos Claude con tu propia clave de API." />
        <ComingSoon title="DeepSeek" description="Modelos DeepSeek con tu propia clave de API." />
        <ComingSoon title="Kimi" description="Modelos Kimi de Moonshot AI con tu propia clave de API." />
      </Category>

      <Category id="drives" title="Drives" description="Carpetas y archivos que Orkesta puede leer y donde puede guardar.">
        <DriveCard workspaceId={workspaceId} isAdmin={isAdmin} notice={notice} />
      </Category>

      <Category id="comunicaciones" title="Comunicaciones" description="Correo y mensajería: bandeja clasificada y envíos con tu aprobación.">
        <GmailCard workspaceId={workspaceId} isAdmin={isAdmin} notice={gmailNotice} />
        <ImapCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <TelegramCard workspaceId={workspaceId} isAdmin={isAdmin} />
        <ComingSoon title="Outlook y Microsoft 365" description="Tu correo de Outlook o de Microsoft 365, con tu cuenta de Microsoft." />
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

async function OpenAICard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: connection } = await supabase
    .from("ai_connections")
    .select("model, key_hint, status, last_validated_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "openai")
    .maybeSingle()
  const modelLabel = OPENAI_MODELS.find((m) => m.id === connection?.model)?.label ?? connection?.model

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h3 className="rotulo text-lg">OpenAI</h3>
          <p className="text-sm text-graphite">El modelo que usan el asistente y las automatizaciones.</p>
        </div>
        <StatusBadge status={connection ? connection.status : null} />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {connection ? (
          <p className="text-sm text-graphite">
            Clave <span className="font-medium text-ink">{connection.key_hint}</span>, modelo{" "}
            <span className="font-medium text-ink">{modelLabel}</span>. Validada el {formatDateTime(connection.last_validated_at)}.
          </p>
        ) : null}

        {isAdmin ? (
          <>
            {connection ? <ModelForm workspaceId={workspaceId} model={connection.model} /> : null}
            <ConnectKeyForm workspaceId={workspaceId} replacing={Boolean(connection)} model={connection?.model} />
            {connection ? <DisconnectForm workspaceId={workspaceId} /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador del espacio puede conectar o cambiar la clave.</p>
        )}

        <details className="text-sm text-graphite">
          <summary className="cursor-pointer text-ink">Cómo consigo una clave y qué se hace con ella</summary>
          <ol className="mt-2 list-decimal pl-5">
            <li>Entra en platform.openai.com con tu cuenta y abre «API keys».</li>
            <li>Crea una clave nueva para Orkesta y cópiala. Tu cuenta de OpenAI necesita saldo o un método de pago.</li>
            <li>Pégala aquí. Orkesta la comprueba con OpenAI y la guarda cifrada; nadie, ni siquiera tú, puede volver a verla.</li>
          </ol>
          <p className="mt-2">
            El consumo se factura en tu cuenta de OpenAI. Orkesta pide a OpenAI que no conserve las conversaciones y anota
            cuántos tokens usa cada petición en Historial.
          </p>
        </details>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status === "invalid") return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Clave rechazada</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}
