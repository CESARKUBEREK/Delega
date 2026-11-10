import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/ui"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"
import { CopyField, CreateKeyForm, RevokeButton } from "./forms"

// Asistentes conectados por MCP (fase 11): Claude, ChatGPT, Grok Bot…
// Solo owners y admins, como la bandeja.

export const metadata = { title: "Asistentes conectados" }

const MCP_URL = "https://www.marchasolo.com/mcp"

const SCOPE_LABEL: Record<string, string> = { read: "leer", organize: "ordenar", drafts: "borradores" }

const TOOL_LABEL: Record<string, string> = {
  get_today: "Para hoy",
  list_threads: "Listar conversaciones",
  get_thread: "Leer una conversación",
  search_threads: "Buscar",
  label_thread: "Etiquetar",
  archive_thread: "Archivar",
  draft_reply: "Borrador",
  list_templates: "Plantillas",
}

function when(iso: string | null): string {
  if (!iso) return "nunca"
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(iso))
}

export default function AssistantsPage({ params }: PageProps<"/w/[workspaceId]/asistentes">) {
  return (
    <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
      <Assistants params={params} />
    </Suspense>
  )
}

async function Assistants({ params }: { params: PageProps<"/w/[workspaceId]/asistentes">["params"] }) {
  const { workspaceId } = await params
  if (!UUID_RE.test(workspaceId)) notFound()
  const user = await requireUser(`/w/${workspaceId}/asistentes`)
  const supabase = await createClient()

  const { data: me } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!me) notFound()
  const isAdmin = me.role === "owner" || me.role === "admin"

  const header = (
    <PageHeader
      eyebrow="CONFIGURACIÓN"
      title="Asistentes conectados"
      description="Usa MarchaSolo desde tu asistente. Puede leer y ordenar tu bandeja y dejarte borradores. Nada se envía sin que lo apruebes aquí."
    />
  )
  if (!isAdmin) {
    return (
      <div className="automation-page flex flex-col">
        {header}
        <p className="text-sm text-ink">Solo los owners y admins del espacio pueden conectar asistentes.</p>
      </div>
    )
  }

  const { data: connections } = await supabase
    .from("mcp_connections")
    .select("id, name, kind, scopes, created_at, last_used_at, revoked_at, user_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(30)
  const active = (connections ?? []).filter((c) => !c.revoked_at)
  const ids = active.map((c) => c.id)
  const { data: calls } = ids.length
    ? await supabase
        .from("mcp_calls")
        .select("connection_id, tool, ok, error_code, created_at")
        .eq("workspace_id", workspaceId)
        .in("connection_id", ids)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] }
  type Call = { connection_id: string; tool: string; ok: boolean; error_code: string | null; created_at: string }
  const callsBy = new Map<string, Call[]>()
  for (const c of (calls ?? []) as Call[]) {
    const list = callsBy.get(c.connection_id) ?? []
    if (list.length < 20) list.push(c)
    callsBy.set(c.connection_id, list)
  }

  return (
    <div className="automation-page flex flex-col">
      {header}

      <div className="settings-page">
        <section>
          <div className="settings-card">
            <h2 className="border-b border-ink px-5 py-3 font-semibold">Conexiones activas</h2>
            {active.length ? (
              <ul className="divide-y divide-rule">
                {active.map((c) => {
                  const recent = callsBy.get(c.id) ?? []
                  return (
                    <li key={c.id} className="flex flex-col gap-2 px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span>
                          <span className="block text-ink">
                            {c.name}
                            {c.user_id === user.id ? <span className="text-graphite"> (tuya)</span> : null}
                          </span>
                          <span className="text-graphite">
                            {c.kind === "oauth" ? "Inicio de sesión" : "Clave de API"} · puede {c.scopes.map((s) => SCOPE_LABEL[s] ?? s).join(", ")} · último uso:{" "}
                            {when(c.last_used_at)}
                          </span>
                        </span>
                        <RevokeButton connectionId={c.id} />
                      </div>
                      {recent.length ? (
                        <details>
                          <summary className="cursor-pointer text-graphite">Últimas llamadas</summary>
                          <ul className="mt-2 flex flex-col gap-1 text-graphite">
                            {recent.map((k, i) => (
                              <li key={i}>
                                {when(k.created_at)} · {TOOL_LABEL[k.tool] ?? k.tool}
                                {k.ok ? "" : ` · no se hizo (${k.error_code ?? "error"})`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-graphite">Todavía no hay ningún asistente conectado.</p>
            )}
          </div>

          <div className="settings-card">
            <h2 className="border-b border-ink px-5 py-3 font-semibold">Cómo conectarlo</h2>
            <div className="flex flex-col gap-4 px-5 py-4 text-sm text-ink">
              <div className="flex flex-col gap-2">
                <p>Dirección del servidor MCP de MarchaSolo:</p>
                <CopyField value={MCP_URL} label="Dirección del servidor MCP" />
              </div>
              <ul className="flex list-disc flex-col gap-2 pl-5">
                <li>
                  <b>Claude:</b> Ajustes → Conectores → Añadir conector personalizado → pega la dirección → inicia sesión en MarchaSolo y elige qué puede hacer.
                  En el plan gratuito de Claude cabe un solo conector personalizado.
                </li>
                <li>
                  <b>ChatGPT:</b> Ajustes → Apps y conectores → Crear (en el modo desarrollador, según tu plan) → pega la dirección → inicia sesión.
                </li>
                <li>
                  <b>Grok Bot:</b> Plugins → añadir servidor MCP personalizado → pega la dirección → inicia sesión. Si la ventana no vuelve, crea una clave
                  abajo y ponla en la cabecera <code>Authorization: Bearer</code>.
                </li>
                <li>
                  <b>Grok Build o Claude Code:</b> <code>grok mcp add --transport http marchasolo {MCP_URL}</code> o{" "}
                  <code>claude mcp add --transport http marchasolo {MCP_URL}</code>.
                </li>
              </ul>
              <p className="text-graphite">
                Límites: con la prueba gratuita, 2 conexiones, 500 llamadas y 20 borradores al día; con tu IA conectada, 5 conexiones, 3.000 llamadas y 100
                borradores. Un borrador pendiente por conversación.
              </p>
            </div>
          </div>

          <div className="settings-card">
            <h2 className="border-b border-ink px-5 py-3 font-semibold">Crear una clave de API</h2>
            <div className="flex flex-col gap-3 px-5 py-4">
              <p className="text-sm text-graphite">
                Solo para asistentes que no inician sesión (Grok Bot, Claude Code, Cursor…). Claude y ChatGPT se conectan iniciando sesión, sin clave.
                Caduca si pasa 90 días sin usarse.
              </p>
              <CreateKeyForm workspaceId={workspaceId} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
