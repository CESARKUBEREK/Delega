import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { USE_CASES, type UseCase } from "@/lib/site-content"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Casos de uso",
  description:
    "WhatsApp del negocio, atención por voz, reservas, ventas, atención al cliente e inmobiliarias. MarchaSolo organiza tareas y prepara acciones para su revisión cuando corresponde.",
  path: "/casos-de-uso",
})

const GROUPS: { id: string; title: string; ids: string[] }[] = [
  {
    id: "canales",
    title: "Canales del negocio",
    ids: ["whatsapp-negocio", "voz-reservas", "reservas-agenda"],
  },
  {
    id: "ventas",
    title: "Ventas",
    ids: ["leads", "seguimiento-ventas", "propuestas"],
  },
  {
    id: "atencion",
    title: "Atención al cliente",
    ids: ["bandeja-clientes", "consultas-repetidas", "postventa"],
  },
  {
    id: "sectores",
    title: "Inmobiliarias y despachos",
    ids: ["inmobiliaria-tokko", "vencimientos", "documentos-modelo"],
  },
]

function casesInGroup(ids: string[]): UseCase[] {
  return ids
    .map((id) => USE_CASES.find((c) => c.id === id))
    .filter((c): c is UseCase => Boolean(c))
}

export default function UseCasesPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Casos de uso</h1>
            <p className="site-lead">
              WhatsApp, atención por voz, reservas, ventas, atención al cliente e inmobiliarias. Describe la tarea en lenguaje cotidiano: MarchaSolo organiza el trabajo con las aplicaciones conectadas y facilita la revisión de las acciones.
            </p>
            <nav aria-label="Áreas" className="mt-8 flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <a key={g.id} href={`#${g.id}`} className="chip no-underline hover:border-[var(--ms-navy)]">
                  {g.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="site-container py-16">
          {GROUPS.map((g) => {
            const items = casesInGroup(g.ids)
            if (!items.length) return null
            return (
              <section key={g.id} id={g.id} className="scroll-mt-24 mb-20 last:mb-0" aria-labelledby={`${g.id}-h`}>
                <h2 id={`${g.id}-h`} className="site-h2 mb-10">
                  {g.title}
                </h2>
                <div className="grid gap-6">
                  {items.map((c) => (
                    <article key={c.id} id={c.id} className="case scroll-mt-24" aria-labelledby={`${c.id}-t`}>
                      <div>
                        <h3 id={`${c.id}-t`} className="site-h2 text-[clamp(26px,2.6vw,34px)]">
                          {c.title}
                        </h3>
                        <dl className="mt-6 grid gap-5">
                          <div>
                            <dt className="font-semibold">Antes</dt>
                            <dd className="m-0 mt-1 text-[var(--ms-muted)]">{c.before}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold">Resultado</dt>
                            <dd className="m-0 mt-1 text-[var(--ms-muted)]">{c.result}</dd>
                          </div>
                        </dl>
                        <div className="case-tags" aria-label="Aplicaciones">
                          {c.tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <CaseTrail item={c} />
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">¿La tarea que buscas no aparece aquí?</h2>
                <p>
                  Describe la tarea al crear la cuenta. MarchaSolo propone un proceso para organizarla y probarla.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Probar gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
