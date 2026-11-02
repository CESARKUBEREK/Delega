import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { USE_CASES } from "@/lib/site-content"

export const metadata: Metadata = {
  title: "Casos de uso",
  description:
    "Ejemplos concretos de tareas que MarchaSolo prepara hoy: correo, documentos, informes, planillas, clientes, reuniones y coordinación. Tú revisas y apruebas antes de que se envíe o cambie nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/casos-de-uso" },
}

export default function UseCasesPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Casos de uso</h1>
            <p className="site-lead">
              Siete tareas que muchos negocios hacen a mano cada semana. Se las pides como a un compañero: MarchaSolo las
              prepara con tus aplicaciones; tú decides qué se envía o se cambia.
            </p>
            <nav aria-label="Casos" className="mt-8 flex flex-wrap gap-2">
              {USE_CASES.map((c) => (
                <a key={c.id} href={`#${c.id}`} className="chip no-underline hover:border-[var(--ms-navy)]">
                  {c.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="site-container py-16">
          {USE_CASES.map((c) => (
            <article key={c.id} id={c.id} className="case scroll-mt-24" aria-labelledby={`${c.id}-t`}>
              <div>
                <h2 id={`${c.id}-t`} className="site-h2 text-[clamp(26px,2.6vw,34px)]">
                  {c.title}
                </h2>
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

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">¿Tu tarea no está aquí?</h2>
                <p>
                  Descríbela con tus palabras al crear la cuenta. MarchaSolo te propone el plan; tú decides si lo pones en
                  marcha.
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
