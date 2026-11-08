import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { Panel, type PanelRow } from "@/components/site/panel"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Qué puedes hacer con MarchaSolo",
  description:
    "Canales del negocio, clientes y rutinas: MarchaSolo prepara el trabajo con las aplicaciones que ya usas. En todos, lo que se envía o se cambia espera tu aprobación.",
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
    title: "WhatsApp del negocio",
    problem:
      "El WhatsApp del negocio no para. Cada mensaje te saca de lo que estabas haciendo; si tardas, el cliente se enfría.",
    solution:
      "MarchaSolo lee el mensaje, busca la respuesta en tus tarifas o FAQ y deja la contestación lista. Solo sale cuando tú la apruebas.",
    result:
      "Atiendes el canal del negocio sin vivir pegado al celular ni soltar el tono de tu marca. Mientras Meta aprueba tu número, puedes empezar con el correo.",
    example:
      "«Cuando escriban por WhatsApp preguntando por precios, usa la tarifa de Drive y déjame la respuesta.»",
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
          label: "Espera tu aprobación",
        },
      ],
    },
  },
  {
    id: "voz",
    title: "Voz, teléfono y reservas",
    problem: "Llamadas perdidas, mensajes en papeles y citas anotadas a ojo fuera de tu horario real.",
    solution:
      "Asistente de voz en tu web y por teléfono: responde con tus documentos, toma mensajes y solo ofrece citas en el horario que tú defines. Cada conversación llega a la Bandeja.",
    result: "Quien llama o habla en la web obtiene una respuesta útil; tú no pierdes el control de la agenda.",
    example:
      "«Atiende las llamadas, toma el mensaje y ofrece cita solo de martes a jueves por la mañana.»",
    panel: {
      title: "Asistente de voz",
      meta: "Llamada · 11:42",
      rows: [
        { title: "Entendió la petición", detail: "Quiere visita el jueves por la mañana", state: "done", label: "Hecho" },
        { title: "Consultó tu horario", detail: "Horarios libres que tú definiste", state: "done", label: "Hecho" },
        {
          title: "Mensaje y propuesta de cita",
          detail: "Jueves 10:00 · queda en tu Bandeja",
          state: "info",
          label: "En la bandeja",
        },
      ],
    },
  },
  {
    id: "comunicaciones",
    title: "Correo y mensajes",
    problem: "Los mensajes llegan por correo, WhatsApp y Telegram, y lo importante se pierde entre boletines y avisos.",
    solution:
      "Una bandeja que se ordena sola: clasifica cada conversación, marca lo urgente y prepara la respuesta en el mismo hilo.",
    result: "Abres «Para hoy» y ves solo lo que espera respuesta, con el borrador listo.",
    example: "«Cuando escriba un cliente que ya conozco, déjame la respuesta preparada.»",
    panel: {
      title: "Para hoy",
      meta: "Bandeja",
      rows: [
        {
          title: "Laura Gómez",
          detail: "Quiere ver el departamento de Palermo",
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
          detail: "Apartados para que no te distraigan",
          state: "info",
          label: "Apartados",
        },
      ],
    },
  },
  {
    id: "clientes",
    title: "Clientes y oportunidades",
    problem:
      "Los contactos y los negocios están en un sitio y las conversaciones en otro; los seguimientos se olvidan.",
    solution:
      "Busca a cada remitente en HubSpot o en Google Contacts, propone altas, notas y tareas, y detecta los negocios parados.",
    result: "Junto a cada conversación ves quién es y en qué punto está su negocio.",
    example:
      "«Los lunes, dime qué negocios llevan dos semanas parados y prepárame un recordatorio para cada cliente.»",
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
          detail: "Contacto nuevo para tu CRM",
          state: "wait",
          label: "Espera tu aprobación",
        },
      ],
    },
  },
  {
    id: "agenda",
    title: "Agenda y citas",
    problem: "Proponer un día y una hora obliga a salir del chat, abrir el calendario y volver a escribir.",
    solution:
      "Consulta tu Google Calendar, elige horarios libres reales y deja preparada la propuesta de visita o reunión en el mismo hilo.",
    result: "Del «¿cuándo puedes?» a una propuesta concreta sin cambiar de aplicación.",
    example: "«Cuando pidan una visita, mira mi agenda y ofrece dos horarios libres esta semana.»",
    panel: {
      title: "Propuesta de visita",
      meta: "Laura Gómez",
      rows: [
        { title: "Leyó la petición", detail: "Quiere ver el departamento esta semana", state: "done", label: "Hecho" },
        { title: "Consultó tu agenda", detail: "Jueves 10:00–12:00 libre", state: "done", label: "Hecho" },
        {
          title: "Respuesta con horario libre",
          detail: "Propone el jueves a las 10:00",
          state: "wait",
          label: "Espera tu aprobación",
        },
      ],
    },
  },
  {
    id: "rutinas",
    title: "Tareas repetitivas",
    problem: "Hay trabajo que se repite cada día o cada semana, siempre igual, y siempre a mano.",
    solution:
      "Automatizaciones que arrancan solas: a una hora fija o al llegar un correo, un Telegram o un WhatsApp.",
    result: "Las rutinas se hacen solas; tú solo apruebas lo que sale hacia fuera.",
    example:
      "«Cada día laborable a las 8:00, resúmeme la bandeja, la agenda y lo que espera mi aprobación.»",
    panel: {
      title: "Tus automatizaciones",
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
            <h1 className="site-h1">Qué puedes hacer con MarchaSolo</h1>
            <p className="site-lead">
              Canales del negocio, clientes y rutinas: MarchaSolo prepara el trabajo con las aplicaciones que ya usas. En
              todos, lo que se envía o se cambia espera tu aprobación.
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
                <p>
                  Elige la que más tiempo te quita —WhatsApp, voz o un seguimiento de ventas—. Cuando funcione, añade la
                  siguiente.
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
