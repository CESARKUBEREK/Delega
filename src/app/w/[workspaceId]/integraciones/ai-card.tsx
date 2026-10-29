import { AI_PROVIDERS, type AiProvider, modelLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "../format"
import { ConnectKeyForm, DefaultForm, DisconnectForm, ModelForm } from "./openai-forms"

// Tarjeta de un proveedor de IA (clave propia). La usan Integraciones y el
// asistente de configuración.
const AI_HELP: Record<AiProvider, { description: string; steps: string[]; note: string }> = {
  openai: {
    description: "Modelos GPT. Es también la que transcribe el dictado por voz.",
    steps: [
      "Entra en platform.openai.com con tu cuenta y abre «API keys».",
      "Crea una clave nueva para MarchaSolo y cópiala. Tu cuenta de OpenAI necesita saldo o un método de pago.",
    ],
    note: "MarchaSolo pide a OpenAI que no conserve las conversaciones (store: false).",
  },
  anthropic: {
    description: "Modelos Claude, de Anthropic.",
    steps: [
      "Entra en platform.claude.com con tu cuenta y abre «API Keys».",
      "Crea una clave nueva para MarchaSolo y cópiala (empieza por sk-ant-). Tu cuenta necesita créditos.",
    ],
    note: "Anthropic no usa los datos de la API para entrenar sus modelos.",
  },
  deepseek: {
    description: "Modelos DeepSeek: muy económicos.",
    steps: [
      "Entra en platform.deepseek.com con tu cuenta y abre «API keys».",
      "Crea una clave nueva para MarchaSolo y cópiala. Tu cuenta necesita saldo.",
    ],
    note: "DeepSeek procesa los datos en servidores fuera de la UE: tenlo en cuenta con datos sensibles de clientes.",
  },
  xai: {
    description: "Modelos Grok, de xAI.",
    steps: [
      "Entra en console.x.ai con tu cuenta y abre «API Keys».",
      "Crea una clave nueva para MarchaSolo y cópiala (empieza por xai-). Tu cuenta necesita créditos.",
    ],
    note: "MarchaSolo pide a xAI que no guarde las conversaciones (store: false). xAI procesa los datos en Estados Unidos.",
  },
}

export async function AiCard({ workspaceId, isAdmin, provider }: { workspaceId: string; isAdmin: boolean; provider: AiProvider }) {
  const supabase = await createClient()
  const { data: connection } = await supabase
    .from("ai_connections")
    .select("model, key_hint, status, last_validated_at, is_default")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle()
  const p = AI_PROVIDERS.find((x) => x.id === provider)!
  const help = AI_HELP[provider]

  return (
    <details name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">{p.label}</h3>
          <p className="text-sm text-graphite">{help.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={connection ? connection.status : null} />
          {connection?.is_default ? <span className="border border-stroke px-2 py-0.5 text-xs text-ink">Principal</span> : null}
        </div>
      </summary>

      <div className="flex flex-col gap-6 px-5 py-5">
        {connection ? (
          <p className="text-sm text-graphite">
            Clave <span className="font-medium text-ink">{connection.key_hint}</span>, modelo{" "}
            <span className="font-medium text-ink">{modelLabel(connection.model)}</span>. Validada el {formatDateTime(connection.last_validated_at)}.
            {connection.is_default ? " Es la IA principal del espacio." : ""}
          </p>
        ) : null}

        {isAdmin ? (
          <>
            {connection && !connection.is_default && connection.status === "active" ? <DefaultForm workspaceId={workspaceId} provider={provider} /> : null}
            {connection ? <ModelForm workspaceId={workspaceId} provider={provider} model={connection.model} /> : null}
            <ConnectKeyForm workspaceId={workspaceId} provider={provider} replacing={Boolean(connection)} model={connection?.model} />
            {connection ? <DisconnectForm workspaceId={workspaceId} provider={provider} /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador del espacio puede conectar o cambiar la clave.</p>
        )}

        <details className="text-sm text-graphite">
          <summary className="cursor-pointer text-ink">Cómo consigo una clave y qué se hace con ella</summary>
          <ol className="mt-2 list-decimal pl-5">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
            <li>Pégala aquí. MarchaSolo la comprueba con {p.label} y la guarda cifrada; nadie, ni siquiera tú, puede volver a verla.</li>
          </ol>
          <p className="mt-2">
            El consumo se factura en tu cuenta de {p.label}, y MarchaSolo anota cuántos tokens usa cada petición en Historial. {help.note}
          </p>
        </details>
      </div>
    </details>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status === "invalid") return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Clave rechazada</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}
