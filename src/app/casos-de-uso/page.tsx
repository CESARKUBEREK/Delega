import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { USE_CASES, type UseCase } from "@/lib/site-content"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Casos de uso",
  description:
    "Descubre ejemplos concretos para automatizar consultas, ventas, atención al cliente, reservas y tareas administrativas. MarchaSolo conecta aplicaciones y coordina cada proceso.",
  path: "/casos-de-uso",
})

const GROUPS: {
  id: string
  eyebrow: string
  title: string
  description: string
  ids: string[]
}[] = [
  {
    id: "comunicacion",
    eyebrow: "Mensajes, llamadas y agenda",
    title: "Atiende y organiza cada consulta",
    description:
      "Reúne conversaciones, consulta la información necesaria y prepara el siguiente paso, sin cambiar continuamente de aplicación.",
    ids: ["whatsapp-negocio", "voz-reservas", "reservas-agenda"],
  },
  {
    id: "ventas",
    eyebrow: "Contactos y oportunidades",
    title: "Da continuidad a tus ventas",
    description:
      "Desde el primer contacto hasta el seguimiento de una oportunidad, conecta mensajes, calendario y CRM para que nada quede disperso.",
    ids: ["leads", "seguimiento-ventas", "propuestas"],
  },
  {
    id: "atencion",
    eyebrow: "Bandeja y relación con clientes",
    title: "Mantén la atención al día",
    description:
      "Identifica lo urgente, encuentra respuestas en tus propios datos y prepara comunicaciones para que puedas revisarlas.",
    ids: ["bandeja-clientes", "consultas-repetidas", "postventa"],
  },
  {
    id: "operaciones",
    eyebrow: "Administración y actividades especializadas",
    title: "Reduce el trabajo administrativo",
    description:
      "Consulta sistemas especializados, controla fechas importantes y prepara documentos a partir de la información disponible.",
    ids: ["inmobiliaria-tokko", "vencimientos", "documentos-modelo"],
  },
]

function casesInGroup(ids: string[]): UseCase[] {
  return ids
    .map((id) => USE_CASES.find((item) => item.id === id))
    .filter((item): item is UseCase => Boolean(item))
}

export default function UseCasesPage() {
  const totalCases = GROUPS.reduce((total, group) => total + casesInGroup(group.ids).length, 0)

  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
              Casos de uso
            </p>
            <h1 className="site-h1">Menos tareas repetitivas. Más trabajo resuelto.</h1>
            <p className="site-lead">
              Cada negocio tiene tareas que se repiten: responder consultas, buscar información,
              coordinar citas o preparar documentos. MarchaSolo conecta las aplicaciones y los
              pasos necesarios para que esos procesos avancen con menos trabajo manual.
            </p>
            <div className="site-actions mt-8">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
              <Link href="/como-funciona" className="btn btn-secondary">
                Ver cómo funciona
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--ms-muted)]">
              {totalCases} ejemplos para inspirarte. Puedes empezar por una sola tarea y adaptar el
              proceso a tu forma de trabajar.
            </p>
            <nav aria-label="Explorar casos por área" className="mt-8 flex flex-wrap gap-2">
              {GROUPS.map((group) => (
                <a
                  key={group.id}
                  href={`#${group.id}`}
                  className="chip no-underline transition-colors hover:border-[var(--ms-navy)]"
                >
                  {group.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="how-to-read">
          <div className="site-container">
            <div className="site-section-head">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                Cómo leer los ejemplos
              </p>
              <h2 id="how-to-read" className="site-h2">
                Una instrucción. Varias tareas coordinadas. Un resultado que puedes revisar.
              </h2>
              <p className="site-lead">
                Cada caso muestra qué problema resuelve, qué puedes pedirle a MarchaSolo y cómo
                coordina el trabajo entre las aplicaciones conectadas. Cuando una acción necesita
                tu autorización, queda pendiente de revisión.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-rule bg-paper p-5">
                <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">01</span>
                <h3 className="site-h3 mt-3">Indicas qué necesitas</h3>
                <p className="mt-2 text-sm text-graphite">
                  Describes la tarea con tus propias palabras y defines cuándo debe realizarse.
                </p>
              </div>
              <div className="rounded-2xl border border-rule bg-paper p-5">
                <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">02</span>
                <h3 className="site-h3 mt-3">Se conectan los pasos</h3>
                <p className="mt-2 text-sm text-graphite">
                  MarchaSolo consulta las herramientas autorizadas y prepara el trabajo previsto.
                </p>
              </div>
              <div className="rounded-2xl border border-rule bg-paper p-5">
                <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">03</span>
                <h3 className="site-h3 mt-3">Revisas lo importante</h3>
                <p className="mt-2 text-sm text-graphite">
                  Conservas el control de los mensajes y de las acciones que requieren aprobación.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="site-container py-16">
          {GROUPS.map((group) => {
            const items = casesInGroup(group.ids)
            if (!items.length) return null

            return (
              <section
                key={group.id}
                id={group.id}
                className="scroll-mt-24 mb-20 last:mb-0"
                aria-labelledby={`${group.id}-heading`}
              >
                <div className="mb-8 max-w-3xl">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                    {group.eyebrow}
                  </p>
                  <h2 id={`${group.id}-heading`} className="site-h2">
                    {group.title}
                  </h2>
                  <p className="site-lead mt-3">{group.description}</p>
                </div>

                <div className="grid gap-6">
                  {items.map((item, index) => (
                    <article
                      key={item.id}
                      id={item.id}
                      className="case scroll-mt-24"
                      aria-labelledby={`${item.id}-title`}
                    >
                      <div>
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ms-muted)]">
                          Caso {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3
                          id={`${item.id}-title`}
                          className="site-h2 text-[clamp(26px,2.6vw,34px)]"
                        >
                          {item.title}
                        </h3>
                        <dl className="mt-6 grid gap-5">
                          <div>
                            <dt className="font-semibold">El desafío</dt>
                            <dd className="m-0 mt-1 text-[var(--ms-muted)]">{item.before}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold">Qué cambia</dt>
                            <dd className="m-0 mt-1 text-[var(--ms-muted)]">{item.result}</dd>
                          </div>
                        </dl>
                        <div className="case-tags" aria-label="Aplicaciones relacionadas">
                          {item.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <CaseTrail item={item} />
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <section className="site-section is-navy" aria-labelledby="make-it-yours">
          <div className="site-container">
            <div className="site-section-head">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                Tu forma de trabajar
              </p>
              <h2 id="make-it-yours" className="site-h2">
                ¿Tu proceso es diferente? Puedes empezar por ahí.
              </h2>
              <p className="site-lead">
                Estos ejemplos son puntos de partida, no procesos cerrados. Elige una tarea que hoy
                haces manualmente, identifica las aplicaciones que intervienen y define qué pasos
                quieres automatizar y cuáles prefieres revisar.
              </p>
            </div>
            <div className="site-actions">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
              <Link href="/integraciones" className="btn btn-secondary">
                Ver aplicaciones disponibles
              </Link>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Tu negocio, en automático.</h2>
                <p>
                  Empieza por el trabajo que más tiempo te quita. Conecta lo necesario y amplía el
                  proceso a tu ritmo.
                </p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
