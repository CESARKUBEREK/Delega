import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { Panel, type PanelRow } from "@/components/site/panel"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Funcionalidades de MarchaSolo",
  description:
    "Un asistente de IA que conecta aplicaciones, coordina tareas y automatiza el trabajo cotidiano. Las acciones sujetas a autorización quedan pendientes de aprobación.",
  path: "/para-que-sirve",
})

type Capability = {
  id: string
  title: string
  problem: string
  solution: string
  result: string
  example: string
  panel: { title: string; meta?: string; rows: PanelRow[] }
}

const CAPABILITIES: Capability[] = [
  {
    id: "whatsapp",
    title: "Atención de consultas por WhatsApp",
    problem:
      "El WhatsApp del negocio no se detiene. Cada mensaje interrumpe otras tareas y una respuesta tardía puede enfriar el interés del cliente.",
    solution:
      "MarchaSolo analiza el mensaje, consulta las tarifas o preguntas frecuentes y prepara una respuesta para revisión antes del envío, según los permisos configurados.",
    result:
      "El canal del negocio recibe atención más organizada, sin perder el tono de marca. Mientras Meta verifica la cuenta, es posible comenzar con el correo.",
    example:
      "«Cuando llegue una consulta por WhatsApp sobre precios, consulta la tarifa de Drive y prepara una respuesta.»",
    panel: {
      title: "WhatsApp",
      meta: "Cliente nuevo",
      rows: [
        { title: "Leyó el mensaje", detail: "Pregunta por precios del pack básico", state: "done", label: "Hecho" },
        { title: "Consultó «Tarifas 2026»", detail: "Google Drive", state: "done", label: "Hecho" },
        {
          title: "Respuesta lista",
          detail: "Texto breve con el precio y la forma de reserva",
          state: "wait",
          label: "Pendiente de aprobación",
        },
      ],
    },
  },
  {
    id: "voz",
    title: "Atención telefónica y reservas",
    problem: "Llamadas perdidas, mensajes en papel y citas anotadas sin consultar la disponibilidad real.",
    solution:
      "Asistente de voz en la web y por teléfono: responde a partir de los documentos conectados, toma mensajes y ofrece citas dentro del horario configurado. Cada conversación llega a la Bandeja.",
    result: "Las personas que llaman o utilizan el asistente web reciben una respuesta útil, con la agenda bajo control.",
    example:
      "«Atiende las llamadas, toma el mensaje y ofrece citas de martes a jueves por la mañana.»",
    panel: {
      title: "Asistente de voz",
      meta: "Llamada · 11:42",
      rows: [
        { title: "Entendió la petición", detail: "Quiere visita el jueves por la mañana", state: "done", label: "Hecho" },
        { title: "Consultó el horario", detail: "Horarios libres configurados", state: "done", label: "Hecho" },
        {
          title: "Mensaje y propuesta de cita",
          detail: "Jueves 10:00 · queda en la bandeja de entrada",
          state: "info",
          label: "En la bandeja",
        },
      ],
    },
  },
  {
    id: "comunicaciones",
    title: "Correo y mensajería organizados",
    problem: "Los mensajes llegan por correo, WhatsApp y Telegram, y lo importante se pierde entre boletines y avisos.",
    solution:
      "Una bandeja organizada que clasifica conversaciones, identifica lo urgente y prepara respuestas en el mismo hilo.",
    result: "En «Para hoy» aparecen las conversaciones que esperan respuesta, con un borrador preparado.",
    example: "«Cuando escriba un cliente que ya conozco, déjame la respuesta preparada.»",
    panel: {
      title: "Para hoy",
      meta: "Bandeja",
      rows: [
        {
          title: "Laura Gómez",
          detail: "Consulta por un inmueble en Palermo",
          state: "wait",
          label: "Respuesta lista",
        },
        {
          title: "Marcos Ruiz",
          detail: "Pregunta por el presupuesto enviado el lunes",
          state: "wait",
          label: "Respuesta lista",
        },
        {
          title: "Boletines y avisos de la semana",
          detail: "Apartados para reducir interrupciones",
          state: "info",
          label: "Apartados",
        },
      ],
    },
  },
  {
    id: "clientes",
    title: "Gestión y seguimiento de clientes",
    problem:
      "Los contactos y los negocios están en un sitio y las conversaciones en otro; los seguimientos se olvidan.",
    solution:
      "Busca cada remitente en HubSpot o Google Contacts, propone nuevos registros, notas y tareas, y detecta oportunidades sin actividad.",
    result: "Cada conversación muestra quién es el contacto y en qué etapa se encuentra la oportunidad.",
    example:
      "«Cada lunes, identifica las oportunidades sin actividad durante dos semanas y prepara un recordatorio para cada contacto.»",
    panel: {
      title: "Negocios parados",
      meta: "Lunes, 9:00",
      rows: [
        {
          title: "Reforma oficina Ruiz",
          detail: "Propuesta enviada hace 16 días, sin cambios",
          state: "wait",
          label: "Recordatorio listo",
        },
        {
          title: "Alta de Clínica Norte",
          detail: "Nuevo contacto para el CRM",
          state: "wait",
          label: "Pendiente de aprobación",
        },
      ],
    },
  },
  {
    id: "agenda",
    title: "Organización de citas y reuniones",
    problem: "Proponer un día y una hora obliga a salir del chat, abrir el calendario y volver a escribir.",
    solution:
      "Consulta Google Calendar, identifica horarios disponibles y prepara una propuesta de visita o reunión en el mismo hilo.",
    result: "De la pregunta por disponibilidad a una propuesta concreta, sin cambiar de aplicación.",
    example: "«Cuando llegue una solicitud de visita, consulta el calendario y ofrece dos horarios disponibles esta semana.»",
    panel: {
      title: "Propuesta de visita",
      meta: "Laura Gómez",
      rows: [
        { title: "Leyó la petición", detail: "Consulta por un inmueble esta semana", state: "done", label: "Hecho" },
        { title: "Consultó la agenda", detail: "Jueves 10:00–12:00 libre", state: "done", label: "Hecho" },
        {
          title: "Respuesta con horario libre",
          detail: "Propone el jueves a las 10:00",
          state: "wait",
          label: "Pendiente de aprobación",
        },
      ],
    },
  },
  {
    id: "rutinas",
    title: "Automatización de tareas recurrentes",
    problem: "Hay trabajo que se repite cada día o cada semana, siempre igual, y siempre a mano.",
    solution:
      "Automatizaciones que se activan a una hora determinada o cuando llega un correo, un mensaje de Telegram o de WhatsApp.",
    result: "Las tareas recurrentes se ejecutan según la configuración; las acciones que requieren autorización quedan pendientes de revisión.",
    example:
      "«Cada día laborable a las 8:00, prepara un resumen de la bandeja, la agenda y las tareas pendientes de revisión.»",
    panel: {
      title: "Automatizaciones del negocio",
      rows: [
        { title: "Resumen de la mañana", detail: "Días laborables, 8:00", state: "done", label: "Activa" },
        { title: "WhatsApp de clientes", detail: "Al llegar un mensaje", state: "done", label: "Activa" },
        { title: "Agenda de mañana", detail: "Días laborables, 18:00", state: "done", label: "Activa" },
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
            <h1 className="site-h1">Un negocio. Muchas tareas. Una sola forma de automatizarlas.</h1>
            <p className="site-lead">
              Un asistente de IA que conecta aplicaciones, coordina tareas y automatiza el trabajo cotidiano. La información y las acciones de cada proceso permanecen visibles, con aprobación cuando corresponde.
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
                    <dt>El problema</dt>
                    <dd>{c.problem}</dd>
                  </div>
                  <div>
                    <dt>Cómo se resuelve</dt>
                    <dd>{c.solution}</dd>
                  </div>
                  <div>
                    <dt>Resultado</dt>
                    <dd>{c.result}</dd>
                  </div>
                  <div>
                    <dt>Ejemplo de instrucción</dt>
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
                <h2 className="site-h2">Comenzar por un proceso</h2>
                <p>
                  Seleccionar un proceso que dependa de tareas manuales. Comenzar con las aplicaciones necesarias y ampliar la automatización progresivamente.
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
