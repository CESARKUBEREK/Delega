import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { Panel, type PanelRow } from "@/components/site/panel"

export const metadata: Metadata = {
  title: "Qué puedes hacer",
  description:
    "Correo y mensajes, documentos e informes, clientes, administración, análisis y tareas repetitivas: lo que MarchaSolo hace por ti, con tu aprobación.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/para-que-sirve" },
}

type Capability = { id: string; title: string; problem: string; solution: string; result: string; example: string; panel: { title: string; meta?: string; rows: PanelRow[] } }

const CAPABILITIES: Capability[] = [
  {
    id: "comunicaciones",
    title: "Correo y mensajes",
    problem: "Los mensajes llegan por correo, WhatsApp y Telegram, y lo importante se pierde entre boletines y avisos.",
    solution: "Una bandeja que se ordena sola: clasifica cada conversación, marca lo urgente y prepara la respuesta en el mismo hilo.",
    result: "Abres «Para hoy» y ves solo lo que espera respuesta, con el borrador listo.",
    example: "«Cuando escriba un cliente que ya conozco, déjame la respuesta preparada.»",
    panel: {
      title: "Para hoy",
      meta: "Bandeja",
      rows: [
        { title: "Laura Gómez", detail: "Quiere ver el piso de la calle Mayor", state: "wait", label: "Respuesta lista" },
        { title: "Marcos Ruiz", detail: "Pregunta por el presupuesto enviado el lunes", state: "wait", label: "Respuesta lista" },
        { title: "Boletines y avisos de la semana", detail: "Apartados para que no te distraigan", state: "info", label: "Apartados" },
      ],
    },
  },
  {
    id: "documentos",
    title: "Documentos e informes",
    problem: "Los informes se escriben a partir de datos repartidos en planillas, documentos y el CRM.",
    solution: "MarchaSolo lee tus archivos de Drive (Google Docs, Sheets, PDF, Word o Excel), redacta el informe y lo guarda donde le digas.",
    result: "El informe aparece cuando toca, sin tener que reunir nada a mano.",
    example: "«Cada viernes, prepárame el informe de la semana y guárdalo en la carpeta Informes.»",
    panel: {
      title: "Informe de la semana",
      meta: "Viernes, 17:00",
      rows: [
        { title: "Leyó «Ventas 2026»", detail: "Planilla de Google Sheets", state: "done", label: "Hecho" },
        { title: "Consultó los negocios de la semana", detail: "CRM", state: "done", label: "Hecho" },
        { title: "Crear «Informe semana 45» en Informes", detail: "Documento nuevo en Drive", state: "wait", label: "Espera tu aprobación" },
      ],
    },
  },
  {
    id: "clientes",
    title: "Clientes y oportunidades",
    problem: "Los contactos y los negocios están en un sitio y las conversaciones en otro; los seguimientos se olvidan.",
    solution: "Busca a cada remitente en HubSpot o en Google Contacts, propone altas, notas y tareas, y detecta los negocios parados.",
    result: "Junto a cada conversación ves quién es y en qué punto está su negocio.",
    example: "«Los lunes, dime qué negocios llevan dos semanas parados y prepárame un recordatorio para cada cliente.»",
    panel: {
      title: "Negocios parados",
      meta: "Lunes, 9:00",
      rows: [
        { title: "Reforma oficina Ruiz", detail: "Propuesta enviada hace 16 días, sin cambios", state: "wait", label: "Recordatorio listo" },
        { title: "Alta de Clínica Norte", detail: "Contacto nuevo para tu CRM", state: "wait", label: "Espera tu aprobación" },
      ],
    },
  },
  {
    id: "administracion",
    title: "Administración y gestión",
    problem: "Vencimientos, cobros y renovaciones viven en planillas que nadie revisa a tiempo.",
    solution: "Lee tus planillas de cobros, contratos o stock y te avisa de lo que vence. Con Xubio consulta facturas y clientes, sin emitir nada.",
    result: "Te enteras de lo que vence esta semana antes de que sea un problema.",
    example: "«Cada lunes, avísame de los contratos y cobros que vencen esta semana.»",
    panel: {
      title: "Control de vencimientos",
      meta: "Lunes, 9:00",
      rows: [
        { title: "3 cobros vencen esta semana", detail: "Planilla «Cobros 2026»", state: "info", label: "Aviso para ti" },
        { title: "Renovación del seguro del local", detail: "Vence el viernes", state: "info", label: "Aviso para ti" },
      ],
    },
  },
  {
    id: "analisis",
    title: "Análisis de información",
    problem: "Para responder una pregunta sencilla hay que cruzar una planilla, un documento y varios correos.",
    solution: "Pregúntalo con tus palabras, en el chat o por Telegram. MarchaSolo consulta tus fuentes y responde con sus datos, sin inventar.",
    result: "Respuestas con cifras de tus propios archivos, y la fuente que ha consultado.",
    example: "«¿Qué clientes de la planilla de pedidos no han vuelto a comprar desde septiembre?»",
    panel: {
      title: "Pedidos sin repetir",
      meta: "Chat",
      rows: [
        { title: "Leyó «Pedidos 2026»", detail: "1.240 filas", state: "done", label: "Hecho" },
        { title: "8 clientes sin pedidos desde septiembre", detail: "Lista con su último pedido e importe", state: "info", label: "Respuesta" },
      ],
    },
  },
  {
    id: "rutinas",
    title: "Tareas repetitivas",
    problem: "Hay trabajo que se repite cada día o cada semana, siempre igual, y siempre a mano.",
    solution: "Automatizaciones que arrancan solas: a una hora (cada día, los laborables, una vez por semana o al mes) o al llegar un correo, un Telegram o un WhatsApp.",
    result: "Las rutinas se hacen solas; tú solo apruebas lo que sale hacia fuera.",
    example: "«Cada día laborable a las 8:00, resúmeme la bandeja, la agenda y lo que espera mi aprobación.»",
    panel: {
      title: "Tus automatizaciones",
      rows: [
        { title: "Resumen de la mañana", detail: "Días laborables, 8:00", state: "done", label: "Activa" },
        { title: "Agenda de mañana", detail: "Días laborables, 18:00", state: "done", label: "Activa" },
        { title: "Facturas a la planilla", detail: "Al llegar un correo con factura", state: "done", label: "Activa" },
      ],
    },
  },
]

export default function WhatYouCanDoPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <h1 className="site-h1">Qué puedes hacer con MarchaSolo</h1>
            <p className="site-lead">
              Seis tipos de trabajo que MarchaSolo hace por ti con las aplicaciones que ya usas. En todos, lo que se envía o se cambia espera tu
              aprobación.
            </p>
            <nav aria-label="Categorías" className="mt-8 flex flex-wrap gap-2">
              {CAPABILITIES.map((c) => (
                <a key={c.id} href={`#${c.id}`} className="chip no-underline hover:border-[var(--ms-navy)]">
                  {c.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="site-container py-10">
          {CAPABILITIES.map((c) => (
            <section key={c.id} id={c.id} className="capability scroll-mt-24" aria-labelledby={`${c.id}-t`}>
              <div>
                <h2 id={`${c.id}-t`} className="site-h2">
                  {c.title}
                </h2>
                <dl className="capability-facts">
                  <div>
                    <dt>Lo habitual</dt>
                    <dd>{c.problem}</dd>
                  </div>
                  <div>
                    <dt>Con MarchaSolo</dt>
                    <dd>{c.solution}</dd>
                  </div>
                  <div>
                    <dt>Resultado</dt>
                    <dd>{c.result}</dd>
                  </div>
                  <div>
                    <dt>Se lo pides así</dt>
                    <dd className="text-[var(--ms-navy)]">{c.example}</dd>
                  </div>
                </dl>
              </div>
              <Panel {...c.panel} />
            </section>
          ))}
        </div>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Empieza por una sola tarea</h2>
                <p>Elige la que más tiempo te quita. Cuando funcione, añade la siguiente.</p>
              </div>
              <Link href="/crear-cuenta" className="btn btn-primary">
                Probar MarchaSolo
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  )
}
