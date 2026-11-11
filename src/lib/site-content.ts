// Contenido del sitio público. Todo lo que se describe aquí existe en el
// producto (plantillas, conectores y aprobaciones); nada de cifras de ahorro
// ni testimonios inventados.
//
// Posicionamiento: equipo digital con IA que conecta aplicaciones, coordina procesos y realiza tareas con supervisión y permisos configurables.
// Casos: canales del negocio (WhatsApp, voz, reservas), ventas, atención al
// cliente y los sectores de lanzamiento (inmobiliarias y despachos).

export type UseCase = {
  id: string
  title: string
  before: string
  ask: string
  does: string
  waits: string | null
  result: string
  tags: string[]
}

export const USE_CASES: UseCase[] = [
  // ——— Canales del negocio ———
  {
    id: "whatsapp-negocio",
    title: "Atención de consultas por WhatsApp",
    before:
      "Los mensajes de WhatsApp interrumpen otras tareas. Consultar tarifas o condiciones y responder a tiempo puede resultar difícil.",
    ask: "Al recibir una consulta por WhatsApp, consultar los documentos y preparar una respuesta.",
    does: "Lee el mensaje, consulta tarifas o FAQ en Drive y redacta una respuesta breve de chat. No inventa datos.",
    waits: "Cada respuesta por WhatsApp, antes de enviarse.",
    result: "La consulta recibe seguimiento y la respuesta queda preparada para revisar y enviar desde la aplicación o el teléfono.",
    tags: ["WhatsApp", "Google Drive"],
  },
  {
    id: "voz-reservas",
    title: "Atención por voz y reservas según el horario",
    before:
      "Algunas llamadas se pierden o se atienden con prisa. Después hay que registrar el mensaje y buscar disponibilidad en la agenda.",
    ask: "Configurar el asistente de voz para atender en la web y por teléfono, ofrecer reservas en el horario establecido y registrar los mensajes en la bandeja.",
    does: "Atiende con los documentos conectados, propone citas dentro de los horarios configurados y registra cada conversación en la Bandeja.",
    waits: "Mensajes y acciones que quedan fuera de las reglas configuradas.",
    result: "Atención telefónica y web con criterios definidos, con mensajes y reservas disponibles para su seguimiento.",
    tags: ["Asistente de voz", "Google Calendar"],
  },
  {
    id: "reservas-agenda",
    title: "Organización de citas y reuniones",
    before:
      "El cliente pide día y hora; abres el calendario, miras disponibilidad y vuelves al chat o al correo.",
    ask: "Al recibir una solicitud de visita o cita, consultar la agenda y preparar una respuesta con dos horarios disponibles.",
    does: "Consulta Google Calendar, identifica horarios disponibles y redacta una propuesta.",
    waits: "La respuesta al cliente (y el evento, si lo crea al aprobar).",
    result: "La conversación pasa de una consulta de disponibilidad a una propuesta concreta, sin salir del mismo hilo.",
    tags: ["Google Calendar", "Correo", "WhatsApp"],
  },

  // ——— Ventas ———
  {
    id: "leads",
    title: "Responder a contactos potenciales y coordinar la primera conversación",
    before:
      "Llegan consultas por correo o WhatsApp; buscas horario libre en la agenda, miras si ya es cliente y contestas cuando puedes.",
    ask: "Al recibir una nueva consulta comercial, consultar la agenda, preparar una respuesta con dos horarios disponibles y registrar el contacto en el CRM.",
    does: "Lee el mensaje, busca si ya existe el contacto, consulta horarios libres en el calendario y redacta la respuesta y el alta en el CRM.",
    waits: "La respuesta al lead y el registro en el CRM.",
    result: "Cada oportunidad recibe una respuesta coherente y el registro queda preparado para su revisión.",
    tags: ["Correo", "WhatsApp", "HubSpot", "Google Calendar"],
  },
  {
    id: "seguimiento-ventas",
    title: "Gestión y seguimiento de oportunidades",
    before:
      "Revisas el CRM a mano para ver qué negocios llevan días sin movimiento y a quién no has vuelto a escribir.",
    ask: "Los lunes, dime qué oportunidades llevan dos semanas sin actividad y prepárame un seguimiento para cada una.",
    does: "Repasa las oportunidades y sus etapas, detecta las paradas y redacta un mensaje de seguimiento por contacto.",
    waits: "Cada mensaje de seguimiento y, si lo pides, la tarea en el CRM.",
    result: "Se reduce el riesgo de olvidar oportunidades sin seguimiento. Los mensajes quedan disponibles para revisión antes del envío.",
    tags: ["HubSpot", "Correo"],
  },
  {
    id: "propuestas",
    title: "Preparar respuestas a peticiones de presupuesto",
    before:
      "Abres el correo de la solicitud, buscas datos del cliente y del producto, y redactas el presupuesto o la respuesta desde cero.",
    ask: "Cuando pidan presupuesto, busca al cliente en el CRM, resume qué piden y déjame un borrador de respuesta con los datos que tengamos.",
    does: "Lee la solicitud, localiza al contacto y el historial, resume el pedido y redacta un borrador listo para revisar.",
    waits: "El envío de la respuesta (y el documento, si lo genera).",
    result: "La solicitud se convierte en un borrador en pocos minutos, listo para revisar los precios y las condiciones antes del envío.",
    tags: ["Correo", "HubSpot", "Google Docs"],
  },

  // ——— Atención al cliente ———
  {
    id: "bandeja-clientes",
    title: "Correo y mensajería organizados",
    before:
      "La bandeja mezcla clientes, proveedores y ruido. Buscas a mano qué espera respuesta y contestas con prisa.",
    ask: "Cada mañana, identificar los mensajes de clientes pendientes de respuesta y preparar borradores para los casos urgentes.",
    does: "Ordena la bandeja: clientes y urgente arriba, el resto aparte. Lee cada hilo y redacta la respuesta en el mismo correo o chat.",
    waits: "Cada respuesta al cliente, antes de enviarse.",
    result: "El día comienza con las tareas pendientes identificadas y los borradores preparados para revisión.",
    tags: ["Correo", "WhatsApp", "Telegram"],
  },
  {
    id: "consultas-repetidas",
    title: "Contestar consultas frecuentes con datos al día",
    before:
      "Las consultas frecuentes (horarios, estados de pedidos, condiciones) exigen buscar información en varias herramientas y preparar la respuesta.",
    ask: "Al recibir una consulta sobre el estado de un pedido o condiciones estándar, consultar los datos y preparar una respuesta.",
    does: "Identifica el tipo de consulta, busca el dato en las aplicaciones del negocio (CRM, hojas de cálculo y correo electrónico) y redacta la respuesta con esa información.",
    waits: "La respuesta al cliente.",
    result: "Menos tareas de copiar y pegar. Las respuestas se preparan a partir de los datos disponibles y quedan listas para revisión.",
    tags: ["Correo", "WhatsApp", "Google Sheets", "HubSpot"],
  },
  {
    id: "postventa",
    title: "Cerrar el círculo después de una venta o una visita",
    before:
      "Después de una venta o una visita, el resumen, la encuesta o el siguiente paso pueden quedar pendientes.",
    ask: "Después de cada visita o cierre, preparar un mensaje de seguimiento con el resumen y el siguiente paso acordado.",
    does: "Detecta el evento (cita cerrada, negocio ganado), reúne el contexto y redacta el mensaje de postventa.",
    waits: "El envío del mensaje (y la tarea en el CRM, si la crea).",
    result: "Cada cliente recibe un seguimiento profesional, con el texto preparado para revisión.",
    tags: ["Google Calendar", "HubSpot", "Correo", "WhatsApp"],
  },

  // ——— Inmobiliarias y despachos (sectores de lanzamiento) ———
  {
    id: "inmobiliaria-tokko",
    title: "Responder consultas por una propiedad con la ficha de Tokko",
    before:
      "Llega una consulta por un aviso; es necesario buscar la propiedad en Tokko, copiar los datos, responder y registrar el contacto.",
    ask: "Al recibir una consulta sobre una propiedad, buscar la ficha en Tokko, preparar una respuesta y registrar la consulta.",
    does: "Lee el mensaje, encuentra la propiedad en Tokko, redacta la respuesta con sus datos y prepara el alta de la consulta.",
    waits: "La respuesta al interesado y el registro en Tokko.",
    result: "La respuesta se prepara con los datos de la ficha y la consulta queda registrada sin carga manual.",
    tags: ["Tokko Broker", "Correo", "WhatsApp"],
  },
  {
    id: "vencimientos",
    title: "Avisos de vencimientos y documentación pendiente",
    before:
      "Contratos, renovaciones y documentación de clientes suelen quedar registrados en hojas de cálculo que requieren revisión periódica.",
    ask: "Cada lunes, revisar la hoja de vencimientos y preparar un aviso sobre los próximos vencimientos y la documentación pendiente.",
    does: "Lee la planilla, ordena lo que vence y lo que falta, y te manda el resumen.",
    waits: null,
    result: "Los vencimientos se identifican a tiempo. El resumen se entrega como aviso interno y no requiere aprobación.",
    tags: ["Google Sheets", "Excel"],
  },
  {
    id: "documentos-modelo",
    title: "Preparación de documentos a partir de plantillas",
    before:
      "Cada propuesta, presupuesto o carta suele comenzar con la copia de un documento anterior y la actualización manual de nombres y datos.",
    ask: "Al confirmar un nuevo cliente, preparar una propuesta en Google Docs a partir de la plantilla y los datos disponibles.",
    does: "Lee tu modelo, toma los datos del cliente del correo o del CRM y crea un documento nuevo en tu Drive con el texto completo.",
    waits: "La creación del documento.",
    result: "Revisas un borrador ya completo en lugar de empezar de cero.",
    tags: ["Google Docs", "Google Drive", "HubSpot"],
  },
]

// Herramientas que se pueden conectar hoy, agrupadas por para qué sirven.
export const TOOL_GROUPS: { title: string; tools: string[] }[] = [
  {
    title: "Correo y mensajes",
    tools: ["Correo (IMAP)", "WhatsApp", "Telegram"],
  },
  {
    title: "Voz y reservas",
    tools: ["Asistente de voz (web y teléfono)", "Google Calendar"],
  },
  {
    title: "Archivos y documentos",
    tools: ["Google Drive", "Google Sheets", "Google Docs", "Excel en Drive"],
  },
  {
    title: "Agenda y clientes",
    tools: ["Google Calendar", "Google Contacts", "HubSpot"],
  },
  {
    title: "Sectores específicos",
    tools: ["Tokko Broker", "Xubio (solo lectura)"],
  },
  {
    title: "Redes y atención",
    tools: ["Buffer", "Asistente de voz en la web del negocio"],
  },
  {
    title: "Inteligencia artificial",
    tools: ["OpenAI", "Anthropic", "DeepSeek", "Grok"],
  },
]
