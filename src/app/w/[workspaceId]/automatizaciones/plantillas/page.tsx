import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { findTemplate, NEED_LABEL, ROUTINES, type RoutineTier, TIER_INFO, type TemplateNeed, VERTICALS } from "@/lib/templates"
import { getWorkspace } from "@/lib/workspace"
import { RoutineCard, TemplateRow } from "./routine-card"

export const metadata = { title: "Rutinas" }

const PROVIDER_NEED: Record<string, TemplateNeed> = {
  imap: "imap",
  telegram: "telegram",
  whatsapp: "whatsapp",
  google: "google",
  calendar: "calendar",
  contacts: "contacts",
  hubspot: "hubspot",
  tokko: "tokko",
  xubio: "xubio",
  buffer: "buffer",
  grok_voice: "voice",
}

export default function TemplatesPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/plantillas">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="app-eyebrow">TU NEGOCIO, EN AUTOMÁTICO</p>
        <h1 className="rotulo text-2xl">Rutinas</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Empieza por tu sector o elige entre las diez rutinas para el día a día de un negocio. Cada una agrupa plantillas listas para usar: al
          elegir una se crea un borrador que ajustas (archivos, horario, filtros) o cambias hablando con el chat. Lo que escriba o envíe a otros
          espera tu aprobación.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
        <RoutineList params={params} />
      </Suspense>
    </div>
  )
}

async function RoutineList({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/plantillas">["params"] }) {
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
    const need = PROVIDER_NEED[i.provider]
    if (i.status === "active" && need) ready.add(need)
  }
  const base = `/w/${workspaceId}`
  const tiers: RoutineTier[] = ["personal", "negocio", "avanzado"]

  return (
    <div className="flex flex-col gap-10">
      <p className="text-sm">
        <Link href={`${base}/automatizaciones`} className="text-link underline underline-offset-4">
          Volver a automatizaciones
        </Link>
      </p>

      <section aria-labelledby="por-sector" className="flex flex-col gap-4">
        <div>
          <h2 id="por-sector" className="rotulo text-xl">
            Por sector
          </h2>
          <p className="text-sm text-graphite">Lo que mejor funciona en tu tipo de negocio: rutinas recomendadas y plantillas propias del sector.</p>
        </div>
        <nav aria-label="Sectores" className="inbox-filters">
          {VERTICALS.map((v) => (
            <a key={v.id} href={`#sector-${v.id}`} className="inbox-filter-chip">
              {v.title}
            </a>
          ))}
        </nav>
        <ul className="routine-grid">
          {VERTICALS.map((v) => (
            <li key={v.id}>
              <article id={`sector-${v.id}`} className="routine-card scroll-mt-24">
                <header>
                  <h3 className="text-lg font-bold text-ink">{v.title}</h3>
                  <p className="text-sm text-graphite">{v.who}</p>
                </header>
                <p className="text-sm text-ink">{v.pitch}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Aplicaciones recomendadas">
                  {v.needs.map((n) => (
                    <li key={n} className={`routine-need ${ready.has(n) ? "is-ready" : ""}`}>
                      {ready.has(n) ? "✓ " : ""}
                      {NEED_LABEL[n]}
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  <span className="font-semibold text-ink">Rutinas recomendadas: </span>
                  {v.routines.map((id, i) => {
                    const r = ROUTINES.find((x) => x.id === id)
                    return r ? (
                      <span key={id}>
                        {i ? ", " : ""}
                        <a href={`#rutina-${id}`} className="text-link underline underline-offset-4">
                          {r.title}
                        </a>
                      </span>
                    ) : null
                  })}
                </p>
                {v.note ? <p className="border-l-2 border-rule pl-3 text-xs text-graphite">{v.note}</p> : null}
                <ul className="flex flex-col gap-3">
                  {v.templates.map((id, i) => {
                    const t = findTemplate(id)
                    return t ? (
                      <li key={id}>
                        <TemplateRow template={t} ready={ready} workspaceId={workspaceId} base={base} primary={i === 0} />
                      </li>
                    ) : null
                  })}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {tiers.map((tier) => (
        <section key={tier} aria-labelledby={`tier-${tier}`} className="flex flex-col gap-4">
          <div>
            <h2 id={`tier-${tier}`} className="rotulo text-xl">
              {TIER_INFO[tier].title}
            </h2>
            <p className="text-sm text-graphite">{TIER_INFO[tier].promise}</p>
          </div>
          <ul className="routine-grid">
            {ROUTINES.filter((r) => r.tier === tier).map((r) => (
              <li key={r.id}>
                <RoutineCard routine={r} ready={ready} base={base} workspaceId={workspaceId} />
              </li>
            ))}
          </ul>
        </section>
      ))}

    </div>
  )
}
