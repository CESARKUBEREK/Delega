import Link from "next/link"
import { Suspense } from "react"
import { TRIGGER_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { NEED_LABEL, TEMPLATES, type TemplateNeed } from "@/lib/templates"
import { getWorkspace } from "@/lib/workspace"
import { createFlowFromTemplate } from "../../ai-actions"

export const metadata = { title: "Plantillas" }

export default function TemplatesPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/plantillas">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Plantillas</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Automatizaciones listas para usar. Al elegir una se crea un borrador: después eliges tus archivos, ajustas los filtros y la
          activas. Todo lo que escriba o envíe espera tu aprobación.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
        <TemplateList params={params} />
      </Suspense>
    </div>
  )
}

async function TemplateList({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/plantillas">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/plantillas`)
  const supabase = await createClient()
  const [{ data: ai }, { data: integrations }] = await Promise.all([
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
    supabase.from("integrations").select("provider, status").eq("workspace_id", workspaceId),
  ])
  const ready = new Set<TemplateNeed>()
  if ((ai ?? []).some((c) => c.status === "active")) ready.add("ai")
  for (const i of integrations ?? []) {
    if (i.status !== "active") continue
    if (i.provider === "imap") ready.add("imap")
    if (i.provider === "telegram") ready.add("telegram")
    if (i.provider === "google") ready.add("google")
    if (i.provider === "calendar") ready.add("calendar")
    if (i.provider === "hubspot") ready.add("hubspot")
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <Link href={`/w/${workspaceId}/automatizaciones`} className="text-link underline underline-offset-4">
          Volver a automatizaciones
        </Link>
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {TEMPLATES.map((t) => {
          const missing = t.needs.filter((n) => !ready.has(n))
          return (
            <li key={t.id} className="flex flex-col gap-3 border border-ink bg-sheet p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-graphite">{t.category}</p>
                <h2 className="mt-1 font-semibold text-ink">{t.plan.name}</h2>
                <p className="mt-1 text-sm text-graphite">{t.plan.summary}</p>
              </div>
              <p className="text-sm text-ink">
                <span className="text-graphite">Arranca: </span>
                {TRIGGER_LABEL[t.plan.trigger.type] ?? t.plan.trigger.type}
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="Necesita">
                {t.needs.map((n) => (
                  <li key={n} className={`border px-2 py-0.5 text-xs ${ready.has(n) ? "border-rule text-ink" : "border-alert text-alert"}`}>
                    {NEED_LABEL[n]}
                    {ready.has(n) ? "" : " (falta)"}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-graphite">{t.setup}</p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                <form action={createFlowFromTemplate}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="templateId" value={t.id} />
                  <button type="submit" className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90">
                    Usar esta plantilla
                  </button>
                </form>
                {missing.length > 0 ? (
                  <Link href={`/w/${workspaceId}/integraciones`} className="text-sm text-link underline underline-offset-4">
                    Conectar lo que falta
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
