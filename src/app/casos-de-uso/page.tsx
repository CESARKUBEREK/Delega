import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { USE_CASES, type UseCase } from "@/lib/site-content"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Casos de uso",
  description:
    "Ejemplos de automatización para comunicaciones, ventas, atención al cliente, reservas y operaciones profesionales. MarchaSolo conecta aplicaciones y coordina procesos completos.",
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
    title: "Ventas y oportunidades",
    ids: ["leads", "seguimiento-ventas", "propuestas"],
  },
  {
    id: "atencion",
    title: "Atención al cliente",
    ids: ["bandeja-clientes", "consultas-repetidas", "postventa"],
  },
  {
    id: "sectores",
    title: "Sectores profesionales",
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
            <h1 className="site-h1">Menos tareas repetitivas. Más trabajo resuelto.</h1>
            <p className="site-lead">
              Ventas, atención al cliente, reservas e inmobiliarias: MarchaSolo conecta los pasos de cada proceso y coordina el trabajo entre las aplicaciones disponibles. Cada ejemplo muestra la instrucción, las tareas coordinadas y el resultado.
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
                            <dt className="font-semibold">El problema</dt>
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
                <h2 className="site-h2">¿Falta algún proceso?</h2>
                <p>
                  Indicar qué necesita resolverse. MarchaSolo ayuda a convertirlo en un proceso organizado que puede ponerse a prueba.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
