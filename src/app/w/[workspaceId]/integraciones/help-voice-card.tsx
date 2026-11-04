import { createClient } from "@/lib/supabase/server"
import { HelpVoiceToggle } from "./help-voice-toggle"

// Opción: hablar por voz con el ayudante «¿Te ayudo?» dentro de MarchaSolo
// (fase 7-4). Apagada por defecto; usa la clave de Grok (xAI) del espacio.
export async function HelpVoiceCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const [{ data: ws }, { data: xai }] = await Promise.all([
    supabase.from("workspaces").select("help_voice_enabled").eq("id", workspaceId).maybeSingle(),
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId).eq("provider", "xai").maybeSingle(),
  ])
  const enabled = Boolean(ws?.help_voice_enabled)
  const xaiActive = xai?.status === "active"
  const ready = enabled && xaiActive

  return (
    <details data-help="voice-app" data-integration-icon="voice" data-integration-status={ready ? "connected" : "setup"} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">En la app: habla con el ayudante</h3>
          <p className="text-sm text-graphite">
            Conversación por voz en tiempo real con el ayudante «¿Te ayudo?»: te guía para conectar tus cuentas y crear automatizaciones mientras
            tienes las manos ocupadas.
          </p>
        </div>
        <span className={`shrink-0 border px-2 py-0.5 text-xs ${ready ? "border-ok text-ok" : "integration-state-setup"}`}>
          {enabled && !xaiActive ? "Conecta Grok" : enabled ? "Activada" : "Desactivada"}
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-5 py-5 text-sm text-graphite">
        <ul className="list-disc pl-5">
          <li>Usa tu clave de Grok (xAI): el consumo, por minuto de conversación, se cobra en tu cuenta de xAI.</li>
          <li>Cada conversación dura como mucho 8 minutos; hay un máximo de 20 al día en el espacio y de 6 por persona y hora.</li>
          <li>Por voz solo te guía y te abre tarjetas: no aprueba nada, no cambia nada y nunca te pedirá claves ni contraseñas.</li>
          <li>La conversación no se guarda.</li>
        </ul>
        {!xaiActive ? (
          <p className="integration-notice is-info border-l-2 pl-3">Antes conecta Grok (xAI) en la sección LLMs.</p>
        ) : null}
        {isAdmin ? (
          <HelpVoiceToggle workspaceId={workspaceId} enabled={enabled} disabled={!xaiActive && !enabled} />
        ) : (
          <p>Solo un administrador puede activarla.</p>
        )}
      </div>
    </details>
  )
}
