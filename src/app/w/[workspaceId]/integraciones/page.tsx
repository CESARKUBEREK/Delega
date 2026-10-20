import { Suspense } from "react"
import { OPENAI_MODELS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { GoogleSheetsCard } from "./google-card"
import { ConnectKeyForm, DisconnectForm, ModelForm } from "./openai-forms"
import { WhatsAppCard } from "./whatsapp-card"

export const metadata = { title: "Integraciones" }

export default function IntegrationsPage({ params, searchParams }: PageProps<"/w/[workspaceId]/integraciones">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Integraciones</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Las conexiones son de este espacio. Delega usa tu propia cuenta de cada servicio y no guarda tus datos más de lo necesario.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <Integrations params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Integrations({
  params,
  searchParams,
}: Pick<PageProps<"/w/[workspaceId]/integraciones">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const notice = sp.google === "conectado" ? "connected" : typeof sp.google_error === "string" ? sp.google_error : null
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/integraciones`)
  const supabase = await createClient()
  const { data: connection } = await supabase
    .from("ai_connections")
    .select("model, key_hint, status, last_validated_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "openai")
    .maybeSingle()
  const modelLabel = OPENAI_MODELS.find((m) => m.id === connection?.model)?.label ?? connection?.model

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section className="border border-ink bg-sheet">
        <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
          <div>
            <h2 className="rotulo text-lg">OpenAI</h2>
            <p className="text-sm text-graphite">El modelo que usa el asistente para preparar tus flujos.</p>
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
              <li>Crea una clave nueva para Delega y cópiala. Tu cuenta de OpenAI necesita saldo o un método de pago.</li>
              <li>Pégala aquí. Delega la comprueba con OpenAI y la guarda cifrada; nadie, ni siquiera tú, puede volver a verla.</li>
            </ol>
            <p className="mt-2">
              El consumo se factura en tu cuenta de OpenAI. Delega pide a OpenAI que no conserve las conversaciones y
              anota cuántos tokens usa cada petición en Historial.
            </p>
          </details>
        </div>
      </section>

      <GoogleSheetsCard workspaceId={workspaceId} isAdmin={isAdmin} notice={notice} />
      <WhatsAppCard workspaceId={workspaceId} isAdmin={isAdmin} />
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status === "invalid") return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Clave rechazada</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}
