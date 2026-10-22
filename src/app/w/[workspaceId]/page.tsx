import Link from "next/link"
import { Suspense } from "react"
import { modelLabel, providerLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "./format"

export const metadata = { title: "Inicio" }

export default function HomePage({ params }: PageProps<"/w/[workspaceId]">) {
  return (
    <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
      <Home params={params} />
    </Suspense>
  )
}

async function Home({ params }: { params: PageProps<"/w/[workspaceId]">["params"] }) {
  const { workspaceId } = await params
  const { isAdmin } = await getWorkspace(workspaceId)
  const supabase = await createClient()
  const base = `/w/${workspaceId}`

  const [{ data: connections }, { count: flowCount }, { data: conversations }, { count: waiting }] = await Promise.all([
    supabase.from("ai_connections").select("provider, model, key_hint, status, is_default").eq("workspace_id", workspaceId),
    supabase.from("flows").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("flow_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "awaiting_approval"),
  ])
  // El proveedor que usa el espacio (o, si no hay ninguno marcado, el primero conectado).
  const connection = connections?.find((c) => c.is_default) ?? connections?.[0]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="rotulo text-2xl">Inicio</h1>

      {waiting ? (
        <Link
          href={`${base}/historial`}
          className="border-2 border-stroke bg-sheet px-5 py-3 font-medium text-ink hover:bg-paper"
        >
          {waiting === 1 ? "1 ejecución espera tu aprobación" : `${waiting} ejecuciones esperan tu aprobación`} →
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="border border-ink bg-sheet p-5">
          <h2 className="text-sm font-medium text-graphite">Inteligencia artificial</h2>
          {connection?.status === "active" ? (
            <>
              <p className="rotulo mt-2 text-lg text-ok">{providerLabel(connection.provider)} conectado</p>
              <p className="mt-1 text-sm text-graphite">
                {modelLabel(connection.model)}, clave {connection.key_hint}
              </p>
            </>
          ) : connection ? (
            <>
              <p className="rotulo mt-2 text-lg text-alert">La clave de {providerLabel(connection.provider)} dejó de funcionar</p>
              <p className="mt-1 text-sm text-graphite">
                {isAdmin ? "Actualízala en Integraciones." : "Pide a un administrador que la actualice."}
              </p>
            </>
          ) : (
            <>
              <p className="rotulo mt-2 text-lg text-ink">Sin conectar</p>
              <p className="mt-1 text-sm text-graphite">
                {isAdmin
                  ? "Conecta una clave de OpenAI, Anthropic, DeepSeek o Kimi para usar el asistente."
                  : "Un administrador tiene que conectar una clave de IA."}
              </p>
            </>
          )}
          <Link href={`${base}/integraciones`} className="mt-4 inline-block text-sm text-link underline underline-offset-4">
            Ir a Integraciones
          </Link>
        </section>

        <section className="border border-ink bg-sheet p-5">
          <h2 className="text-sm font-medium text-graphite">Automatizaciones</h2>
          <p className="rotulo mt-2 text-lg text-ink">
            {flowCount ?? 0} {flowCount === 1 ? "automatización" : "automatizaciones"}
          </p>
          <p className="mt-1 text-sm text-graphite">Describe una tarea al asistente y guarda el plan que te proponga.</p>
          <Link href={`${base}/asistente`} className="mt-4 inline-block text-sm text-link underline underline-offset-4">
            Abrir el asistente
          </Link>
        </section>
      </div>

      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">Conversaciones recientes</h2>
        {conversations && conversations.length > 0 ? (
          <ul className="divide-y divide-rule">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/asistente?c=${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-paper">
                  <span className="truncate text-ink">{c.title}</span>
                  <span className="shrink-0 text-sm text-graphite">{formatDateTime(c.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-graphite">Todavía no has hablado con el asistente en este espacio.</p>
        )}
      </section>
    </div>
  )
}
