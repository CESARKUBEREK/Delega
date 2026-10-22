import { LLM_PROVIDERS, type LlmProvider, modelLabel } from "@/lib/plan"
import { formatDateTime } from "../format"
import { ConnectKeyForm, DefaultForm, DisconnectForm, ModelForm } from "./llm-forms"

export type LlmConnection = {
  provider: string
  model: string
  key_hint: string
  status: string
  last_validated_at: string
  is_default: boolean
}

function Badge({ connection }: { connection: LlmConnection | undefined }) {
  if (!connection) return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
  if (connection.status !== "active") {
    return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Clave rechazada</span>
  }
  if (connection.is_default) return <span className="shrink-0 border border-ok bg-ok-bg px-2 py-0.5 text-xs text-ok">En uso</span>
  return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
}

export function LlmCard({
  workspaceId,
  provider,
  connection,
  isAdmin,
}: {
  workspaceId: string
  provider: LlmProvider
  connection: LlmConnection | undefined
  isAdmin: boolean
}) {
  const info = LLM_PROVIDERS[provider]
  return (
    <section className={`border bg-sheet ${connection?.is_default ? "border-2 border-stroke" : "border-ink"}`}>
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h3 className="rotulo text-lg">{info.label}</h3>
          <p className="text-sm text-graphite">{info.description}</p>
        </div>
        <Badge connection={connection} />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {connection ? (
          <p className="text-sm text-graphite">
            Clave <span className="font-medium text-ink">{connection.key_hint}</span>, modelo{" "}
            <span className="font-medium text-ink">{modelLabel(connection.model)}</span>. Validada el{" "}
            {formatDateTime(connection.last_validated_at)}.{" "}
            {connection.is_default
              ? "Es el proveedor que usan el asistente, la bandeja y las automatizaciones de este espacio."
              : "Conectado, pero el espacio usa otro proveedor."}
          </p>
        ) : null}

        {isAdmin ? (
          <>
            {connection && !connection.is_default && connection.status === "active" ? (
              <DefaultForm workspaceId={workspaceId} provider={provider} />
            ) : null}
            {connection ? <ModelForm workspaceId={workspaceId} provider={provider} model={connection.model} /> : null}
            <ConnectKeyForm workspaceId={workspaceId} provider={provider} replacing={Boolean(connection)} model={connection?.model} />
            {connection ? <DisconnectForm workspaceId={workspaceId} provider={provider} isDefault={connection.is_default} /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador del espacio puede conectar o cambiar la clave.</p>
        )}

        <details className="text-sm text-graphite">
          <summary className="cursor-pointer text-ink">Cómo consigo una clave y qué se hace con ella</summary>
          <ol className="mt-2 list-decimal pl-5">
            {info.keysSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
            <li>
              Pégala aquí. Orkesta la comprueba con {info.label} y la guarda cifrada; nadie, ni siquiera tú, puede volver a verla.
            </li>
          </ol>
          <p className="mt-2">
            <a href={info.keysUrl} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-4">
              Abrir la página de claves de {info.label}
            </a>
          </p>
          <p className="mt-2">
            El consumo se factura en tu cuenta de {info.label}, y Orkesta anota los tokens de cada petición en Historial.{" "}
            {info.privacy}
          </p>
        </details>
      </div>
    </section>
  )
}
