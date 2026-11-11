import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { CaseTrail } from "@/components/site/case-trail"
import { publicPageMetadata } from "@/lib/seo"
import { USE_CASES } from "@/lib/site-content"

export const metadata = publicPageMetadata({
  title: "Para qué sirve MarchaSolo",
  description:
    "Descubre cómo MarchaSolo conecta las aplicaciones de tu negocio, coordina tareas y automatiza procesos para reducir el trabajo manual.",
  path: "/para-que-sirve",
})

const FEATURED_CASES = [
  "leads",
  "bandeja-clientes",
  "seguimiento-ventas",
  "reservas-agenda",
  "documentos-modelo",
  "vencimientos",
] as const

const STEPS = [
  {
    number: "01",
    title: "Llega una tarea",
    description: "Un mensaje, un correo, una solicitud o una hora programada pone en marcha el proceso.",
  },
  {
    number: "02",
    title: "Se reúne la información",
    description: "MarchaSolo consulta las aplicaciones conectadas y reúne el contexto necesario.",
  },
  {
    number: "03",
    title: "El trabajo avanza",
    description: "Coordina los pasos, prepara respuestas, organiza datos y deja visible el progreso.",
  },
  {
    number: "04",
    title: "Tú mantienes el control",
    description: "Revisas y autorizas las acciones externas cuando la configuración lo requiere.",
  },
]

export default function WhatIsItForPage() {
  const cases = FEATURED_CASES
    .map((id) => USE_CASES.find((item) => item.id === id))
    .filter((item): item is (typeof USE_CASES)[number] => Boolean(item))

  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
              Para qué sirve
            </p>
            <h1 className="site-h1">Menos tareas manuales. Más negocio en marcha.</h1>
            <p className="site-lead">
              MarchaSolo conecta las aplicaciones que ya utilizas y coordina el trabajo que pasa
              entre ellas. Desde responder una consulta hasta preparar un documento o dar
              seguimiento a un cliente, puedes automatizar procesos sin tener que aprender
              herramientas complicadas.
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
              Empieza con una tarea concreta. Amplía la automatización cuando la necesites.
            </p>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="workflow">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="workflow" className="site-h2">
                De aplicaciones separadas a un proceso coordinado
              </h2>
              <p className="site-lead">
                En lugar de copiar información de una herramienta a otra, MarchaSolo conecta los
                pasos para que el trabajo avance con más continuidad.
              </p>
            </div>
            <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.number} className="rounded-2xl border border-rule bg-paper p-5">
                  <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">
                    {step.number}
                  </span>
                  <h3 className="site-h3 mt-3">{step.title}</h3>
                  <p className="mt-2 text-sm text-graphite">{step.description}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-graphite">
              Cada proceso utiliza las aplicaciones y los permisos que hayas configurado. Las
              acciones externas sujetas a aprobación quedan pendientes de tu revisión.
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="examples">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="examples" className="site-h2">
                ¿Qué puedes dejar de hacer manualmente?
              </h2>
              <p className="site-lead">
                Estos son algunos ejemplos de tareas que puedes convertir en procesos coordinados.
                Cada flujo se adapta a las aplicaciones y reglas de tu negocio.
              </p>
            </div>
            <div className="grid gap-10 md:grid-cols-2">
              {cases.map((item) => (
                <article key={item.id} className="flex flex-col gap-4">
                  <div>
                    <h3 className="site-h3">{item.title}</h3>
                    <p className="mt-2 text-sm text-graphite">{item.before}</p>
                  </div>
                  <CaseTrail item={item} />
                  <p className="site-small m-0">{item.result}</p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Aplicaciones relacionadas">
                    {item.tags.map((tag) => (
                      <li key={tag} className="chip">{tag}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mt-10">
              <Link href="/casos-de-uso" className="link">
                Explorar todos los casos de uso →
              </Link>
            </p>
          </div>
        </section>

        <section className="site-section is-navy" aria-labelledby="who">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="who" className="site-h2">
                Para quienes necesitan hacer más con menos trabajo manual.
              </h2>
              <p className="site-lead">
                MarchaSolo puede adaptarse a distintas actividades: lo importante es identificar
                tareas repetitivas, información dispersa o procesos que dependen de varias
                aplicaciones.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">Profesionales independientes</h3>
                <p>Organiza consultas, prepara respuestas, gestiona citas y reserva tiempo para el trabajo con tus clientes.</p>
              </li>
              <li>
                <h3 className="site-h3">Pequeños negocios y equipos</h3>
                <p>Conecta las herramientas del negocio, coordina tareas y facilita el seguimiento de cada oportunidad.</p>
              </li>
              <li>
                <h3 className="site-h3">Agencias y actividades especializadas</h3>
                <p>Reúne información de clientes, prepara documentos y coordina procesos que hoy pasan por varias aplicaciones.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="start-small">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="start-small" className="site-h2">
                No necesitas automatizar todo de una vez.
              </h2>
              <p className="site-lead">
                Elige una tarea que se repita, conecta solo las aplicaciones necesarias y revisa
                cómo funciona. Después puedes ajustar el proceso y sumar nuevos pasos.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="site-h3">Empieza por lo cotidiano</h3>
                <p className="text-sm text-graphite">Una consulta, un seguimiento semanal o un resumen de tareas pendientes.</p>
              </div>
              <div>
                <h3 className="site-h3">Conecta lo necesario</h3>
                <p className="text-sm text-graphite">Correo, calendario, documentos, mensajería o CRM, según el proceso.</p>
              </div>
              <div>
                <h3 className="site-h3">Amplía a tu ritmo</h3>
                <p className="text-sm text-graphite">Añade nuevas automatizaciones cuando el primer proceso ya te resulte útil.</p>
              </div>
            </div>
            <p className="mt-8">
              <Link href="/integraciones" className="link">
                Ver aplicaciones que puedes conectar →
              </Link>
            </p>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Tu negocio, en automático.</h2>
                <p>
                  Empieza por el trabajo que más tiempo te quita. MarchaSolo te ayuda a conectar
                  los pasos y mantener el control del proceso.
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
