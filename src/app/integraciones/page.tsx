import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Integraciones",
  description:
    "Conecta correo, mensajería, documentos, agenda y herramientas de gestión. MarchaSolo coordina el trabajo entre las aplicaciones de tu negocio.",
  path: "/integraciones",
})

type AppIcon = {
  id: string
  name: string
  logo?: string
  note?: string
  status?: "soon"
}

const GROUPS: { id: string; title: string; description: string; apps: AppIcon[] }[] = [
  {
    id: "comunicacion",
    title: "Comunicación y atención",
    description: "Reúne consultas y prepara el siguiente paso sin saltar de una herramienta a otra.",
    apps: [
      { id: "imap", name: "Correo IMAP / SMTP", note: "Tu cuenta de correo" },
      { id: "whatsapp", name: "WhatsApp Business", logo: "/brand/whatsapp.svg", note: "Mensajes y respuestas" },
      { id: "telegram", name: "Telegram", logo: "/brand/telegram.svg", note: "Bot de Telegram" },
      { id: "voz", name: "Asistente de voz", note: "Web y teléfono" },
      { id: "outlook", name: "Outlook y Microsoft 365", note: "Próximamente", status: "soon" },
    ],
  },
  {
    id: "documentos",
    title: "Archivos, cálculos y documentos",
    description: "Usa la información que ya tienes en tus archivos para preparar respuestas, informes y documentos.",
    apps: [
      { id: "drive", name: "Google Drive", logo: "/brand/googledrive.svg", note: "Archivos y carpetas elegidos" },
      { id: "sheets", name: "Google Sheets", logo: "/brand/googlesheets.svg", note: "Planillas y datos" },
      { id: "excel", name: "Excel", note: "Archivos guardados en Drive" },
      { id: "docs", name: "Google Docs", logo: "/brand/googledocs.svg", note: "Documentos y plantillas" },
    ],
  },
  {
    id: "agenda-clientes",
    title: "Agenda y clientes",
    description: "Relaciona las conversaciones con tus contactos, oportunidades y compromisos.",
    apps: [
      { id: "calendar", name: "Google Calendar", logo: "/brand/googlecalendar.svg", note: "Disponibilidad y eventos" },
      { id: "contacts", name: "Google Contacts", note: "Contactos" },
      { id: "hubspot", name: "HubSpot", logo: "/brand/hubspot.svg", note: "CRM y oportunidades" },
    ],
  },
  {
    id: "gestion",
    title: "Herramientas de gestión",
    description: "Conecta aplicaciones especializadas para trabajar con la información de tu actividad.",
    apps: [
      { id: "tokko", name: "Tokko Broker", note: "Gestión inmobiliaria" },
      { id: "xubio", name: "Xubio", note: "Contabilidad · solo lectura" },
      { id: "buffer", name: "Buffer", note: "Publicaciones en redes sociales" },
    ],
  },
  {
    id: "datos",
    title: "Datos y bases de datos",
    description: "Conecta los datos de tu negocio para consultarlos y utilizarlos dentro de tus procesos.",
    apps: [
      { id: "supabase", name: "Supabase", note: "Base de datos y servicios de backend" },
    ],
  },
  {
    id: "modelos",
    title: "Modelos para tareas inteligentes",
    description: "Conecta tu proveedor y utiliza sus modelos para interpretar solicitudes, analizar información y preparar resultados.",
    apps: [
      { id: "openai", name: "OpenAI", logo: "/brand/openai.svg", note: "Modelos GPT" },
      { id: "anthropic", name: "Anthropic", logo: "/brand/anthropic.svg", note: "Modelos Claude" },
      { id: "deepseek", name: "DeepSeek", note: "Modelos DeepSeek" },
      { id: "xai", name: "xAI", logo: "/brand/x.svg", note: "Modelos Grok" },
    ],
  },
]

const FLOW = [
  {
    number: "01",
    title: "Llega una consulta",
    body: "El mensaje entra por WhatsApp o correo.",
    apps: "WhatsApp · Correo",
  },
  {
    number: "02",
    title: "Se reúne la información",
    body: "Se consulta la ficha del cliente y los documentos relevantes.",
    apps: "HubSpot · Google Drive",
  },
  {
    number: "03",
    title: "Se organiza el siguiente paso",
    body: "Se prepara una respuesta, un seguimiento o una propuesta de cita.",
    apps: "Google Calendar · Documentos",
  },
  {
    number: "04",
    title: "Tú revisas y decides",
    body: "El mensaje o cambio que requiere autorización queda pendiente de tu aprobación.",
    apps: "Revisión en MarchaSolo",
  },
]

export default function IntegrationsMarketingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="page-intro">
          <div className="site-container">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
              Integraciones
            </p>
            <h1 className="site-h1">Las aplicaciones trabajan mejor cuando están conectadas.</h1>
            <p className="site-lead">
              MarchaSolo conecta las herramientas que ya utilizas para que la información circule,
              las tareas estén coordinadas y el trabajo avance de una aplicación a otra. No necesitas
              cambiar todo tu sistema: empieza por las herramientas que intervienen en una tarea.
            </p>
            <div className="site-actions mt-8">
              <Link href="/crear-cuenta" className="btn btn-primary">
                Comenzar gratis
              </Link>
              <Link href="/como-funciona" className="btn btn-secondary">
                Ver cómo funciona
              </Link>
            </div>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="connected-work">
          <div className="site-container">
            <div className="site-section-head">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-accent)]">
                El valor está en conectarlas
              </p>
              <h2 id="connected-work" className="site-h2">
                De aplicaciones aisladas a un proceso que avanza.
              </h2>
              <p className="site-lead">
                Una consulta de un cliente puede requerir revisar mensajes, buscar datos, consultar
                la agenda y preparar una respuesta. MarchaSolo coordina esos pasos para evitar que
                tengas que reunir la información manualmente cada vez.
              </p>
            </div>
            <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {FLOW.map((step) => (
                <li key={step.number} className="rounded-2xl border border-rule bg-paper p-5">
                  <span className="text-sm font-bold tracking-widest text-[var(--ms-accent)]">
                    {step.number}
                  </span>
                  <h3 className="site-h3 mt-3">{step.title}</h3>
                  <p className="mt-2 text-sm text-graphite">{step.body}</p>
                  <p className="mt-4 border-t border-rule pt-3 text-xs font-semibold text-ink">
                    {step.apps}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-graphite">
              Es un ejemplo de cómo pueden colaborar varias herramientas. Las aplicaciones y los
              pasos concretos dependen de la automatización que configures. Las acciones externas
              sujetas a aprobación esperan tu revisión antes de ejecutarse.
            </p>
          </div>
        </section>

        <section className="site-section" aria-labelledby="by-need">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="by-need" className="site-h2">
                Conecta herramientas para resolver tareas reales.
              </h2>
              <p className="site-lead">
                Puedes combinar aplicaciones de distintas categorías según el trabajo que quieras
                simplificar.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">Atención y seguimiento</h3>
                <p>Reúne consultas de correo y mensajería, consulta información del cliente y prepara respuestas para revisar.</p>
              </li>
              <li>
                <h3 className="site-h3">Agenda y coordinación</h3>
                <p>Consulta disponibilidad, organiza citas y relaciona cada conversación con el contacto correspondiente.</p>
              </li>
              <li>
                <h3 className="site-h3">Documentos y administración</h3>
                <p>Consulta planillas y archivos, prepara documentos y utiliza información contable o comercial disponible.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section is-white" aria-labelledby="apps">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="apps" className="site-h2">
                Aplicaciones y servicios
              </h2>
              <p className="site-lead">
                Estas son las herramientas que puedes conectar desde MarchaSolo. Algunas comparten
                una misma conexión: por ejemplo, Google Drive permite seleccionar los archivos que
                utilizarán Sheets, Excel y Docs.
              </p>
            </div>

            <div className="space-y-10">
              {GROUPS.map((group) => (
                <section key={group.id} aria-labelledby={group.id + "-title"}>
                  <div className="mb-4">
                    <h3 id={group.id + "-title"} className="site-h3">{group.title}</h3>
                    <p className="mt-1 text-sm text-graphite">{group.description}</p>
                  </div>
                  <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {group.apps.map((app) => (
                      <li
                        key={app.id}
                        className="flex items-center gap-3 rounded-2xl border border-rule bg-paper px-4 py-3"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rule bg-sheet p-2.5"
                          aria-hidden="true"
                        >
                          {app.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={app.logo}
                              alt=""
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-sm font-bold text-[var(--ms-navy)]">
                              {app.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold text-ink">{app.name}</span>
                          <span className="text-xs text-graphite">
                            {app.status === "soon" ? "Próximamente" : app.note}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="custom">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="custom" className="site-h2">
                ¿Tu negocio utiliza otros sistemas?
              </h2>
              <p className="site-lead">
                También puedes conectar bases de datos y servicios propios mediante APIs. Así,
                MarchaSolo puede consultar información de tus sistemas y coordinarla con el resto
                de las herramientas del proceso.
              </p>
            </div>
            <ul className="audience">
              <li>
                <h3 className="site-h3">APIs REST</h3>
                <p>Conecta hasta dos servicios personalizados con sus propias credenciales.</p>
              </li>
              <li>
                <h3 className="site-h3">Procesos a medida</h3>
                <p>Combina consultas, preparación de información y pasos de revisión en un mismo flujo.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-section is-navy" aria-labelledby="control">
          <div className="site-container">
            <div className="site-section-head">
              <h2 id="control" className="site-h2">
                Conectar no significa ceder el control.
              </h2>
              <p className="site-lead">
                Tú decides qué herramientas conectar y qué archivos compartir. Las credenciales se
                guardan cifradas y las acciones externas que requieren autorización quedan
                pendientes para que puedas revisarlas antes de ejecutarlas.
              </p>
            </div>
            <div className="trust">
              <div>
                <h3 className="site-h3">Eliges qué compartir</h3>
                <p>En Google Drive seleccionas las carpetas y los archivos que MarchaSolo puede utilizar.</p>
              </div>
              <div>
                <h3 className="site-h3">Revisas antes de actuar</h3>
                <p>Los mensajes, publicaciones y cambios que requieren aprobación esperan tu decisión.</p>
              </div>
              <div>
                <h3 className="site-h3">Empiezas de forma gradual</h3>
                <p>Conecta solo lo necesario para una tarea y suma otras herramientas cuando las necesites.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section pt-0">
          <div className="site-container">
            <div className="site-cta">
              <div>
                <h2 className="site-h2">Haz que tus aplicaciones trabajen en conjunto.</h2>
                <p>
                  Empieza con una tarea concreta. Conecta las herramientas que ya utilizas y deja
                  que MarchaSolo coordine los pasos.
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
