// Contenido del sitio público. Todo lo que se describe aquí existe en el
// producto (plantillas, conectores y aprobaciones); nada de cifras de ahorro
// ni testimonios inventados.
//
// Posicionamiento: compañero que prepara el trabajo; la decisión final es del usuario.
// Casos orientados a ventas, atención al cliente y soporte técnico.

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
    title: "Atender el WhatsApp del negocio sin vivir pegado al móvil",
    before:
      "Cada mensaje de WhatsApp te interrumpe. Buscas tarifas o condiciones y contestas cuando puedes; a veces se enfría el cliente.",
    ask: "Cuando un cliente escriba por WhatsApp, busca la respuesta en mis documentos y déjame la contestación preparada.",
    does: "Lee el mensaje, consulta tarifas o FAQ en Drive y redacta una respuesta breve de chat. No inventa datos.",
    waits: "Cada respuesta por WhatsApp, antes de enviarse.",
    result: "El cliente no espera en silencio. Tú revisas en la app o en el móvil y envías en un toque.",
    tags: ["WhatsApp", "Google Drive"],
  },
  {
    id: "voz-reservas",
    title: "Atención por voz y reservas en tu horario",
    before:
      "Pierdes llamadas o las coges a medias. Apuntas el recado a mano y luego buscas hueco en la agenda.",
    ask: "Que el asistente de voz atienda en la web y por teléfono, reserve solo en mi horario y me deje los recados en la bandeja.",
    does: "Atiende con tus documentos, propone citas solo en los huecos que tú definiste y deja cada conversación en la Bandeja.",
    waits: "Lo que implique enviar un mensaje o crear algo fuera de las reglas que tú fijaste.",
    result: "Llamadas y web atendidas con tu criterio. Tú ves el recado o la reserva y decides el siguiente paso.",
    tags: ["Asistente de voz", "Google Calendar"],
  },
  {
    id: "reservas-agenda",
    title: "Proponer visitas y citas con huecos reales",
    before:
      "El cliente pide día y hora; abres el calendario, miras disponibilidad y vuelves al chat o al correo.",
    ask: "Cuando pidan una visita o una cita, mira mi agenda y prepárame una respuesta con dos huecos libres.",
    does: "Consulta Google Calendar, elige huecos dentro de tu disponibilidad y redacta la propuesta.",
    waits: "La respuesta al cliente (y el evento, si lo crea al aprobar).",
    result: "Pasas de «¿cuándo puedes?» a una propuesta concreta sin salir del hilo. Tú confirmas.",
    tags: ["Google Calendar", "Correo", "WhatsApp"],
  },  
  
  
  // ——— Ventas ———
  {
    id: "leads",
    title: "Responder a leads y agendar la primera conversación",
    before:
      "Llegan consultas por correo o WhatsApp; buscas hueco en la agenda, miras si ya es cliente y contestas cuando puedes.",
    ask: "Cuando entre un lead nuevo, mira mi agenda, prepárame una respuesta con dos huecos libres y regístralo en el CRM.",
    does: "Lee el mensaje, busca si ya existe el contacto, consulta huecos en el calendario y redacta la respuesta y el alta en el CRM.",
    waits: "La respuesta al lead y el registro en el CRM.",
    result: "Cada lead recibe una respuesta rápida y coherente. Tú solo apruebas el mensaje y el alta.",
    tags: ["Correo", "WhatsApp", "HubSpot", "Google Calendar"],
  },
  {
    id: "seguimiento-ventas",
    title: "Seguir oportunidades que se han enfriado",
    before:
      "Revisas el CRM a mano para ver qué negocios llevan días sin movimiento y a quién no has vuelto a escribir.",
    ask: "Los lunes, dime qué oportunidades llevan dos semanas sin actividad y prepárame un seguimiento para cada una.",
    does: "Repasa las oportunidades y sus etapas, detecta las paradas y redacta un mensaje de seguimiento por contacto.",
    waits: "Cada mensaje de seguimiento y, si lo pides, la tarea en el CRM.",
    result: "Ninguna oportunidad se queda sin toque por despiste. Tú eliges qué enviar y cuándo.",
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
    result: "Pasas de la solicitud al borrador en minutos. Tú ajustas precio y condiciones y envías.",
    tags: ["Correo", "HubSpot", "Google Docs"],
  },

  // ——— Atención al cliente ———
  {
    id: "bandeja-clientes",
    title: "Ordenar la bandeja y preparar respuestas al cliente",
    before:
      "La bandeja mezcla clientes, proveedores y ruido. Buscas a mano qué espera respuesta y contestas con prisa.",
    ask: "Cada mañana, dime qué mensajes de clientes esperan respuesta y déjame preparadas las respuestas urgentes.",
    does: "Ordena la bandeja: clientes y urgente arriba, el resto aparte. Lee cada hilo y redacta la respuesta en el mismo correo o chat.",
    waits: "Cada respuesta al cliente, antes de enviarse.",
    result: "Empiezas el día con lo pendiente claro y los borradores listos. Tú revisas el tono y envías.",
    tags: ["Correo", "WhatsApp", "Telegram"],
  },
  {
    id: "consultas-repetidas",
    title: "Contestar consultas frecuentes con datos al día",
    before:
      "Te preguntan lo mismo (horarios, estados de pedido, condiciones). Buscas la info en varias herramientas y copias la respuesta.",
    ask: "Cuando pregunten por el estado de un pedido o por condiciones estándar, busca los datos y prepárame la respuesta.",
    does: "Identifica el tipo de consulta, busca el dato en tus apps (CRM, hojas, correo) y redacta la respuesta con esa información.",
    waits: "La respuesta al cliente.",
    result: "Menos copiar y pegar. El cliente recibe datos correctos; tú solo das el visto bueno.",
    tags: ["Correo", "WhatsApp", "Google Sheets", "HubSpot"],
  },
  {
    id: "postventa",
    title: "Cerrar el círculo después de una venta o una visita",
    before:
      "Tras una venta o una visita, te acuerdas (o no) de enviar el resumen, la encuesta o el siguiente paso.",
    ask: "Después de cada visita o cierre, prepárame el mensaje de seguimiento con el resumen y el siguiente paso que acordamos.",
    does: "Detecta el evento (cita cerrada, negocio ganado), reúne el contexto y redacta el mensaje de postventa.",
    waits: "El envío del mensaje (y la tarea en el CRM, si la crea).",
    result: "Cada cliente recibe un cierre profesional. Tú apruebas el texto en un toque.",
    tags: ["Google Calendar", "HubSpot", "Correo", "WhatsApp"],
  },

  // ——— Soporte técnico ———
  {
    id: "tickets",
    title: "Clasificar incidencias y preparar la primera respuesta",
    before:
      "Llegan avisos por correo o chat; lees, decides prioridad, buscas si ya hubo un caso parecido y contestas cuando puedes.",
    ask: "Cuando entre una incidencia, clasifícala, busca si hay un caso similar y déjame una primera respuesta con lo que sepamos.",
    does: "Lee el mensaje, propone prioridad y tipo, busca en historial o base de conocimiento y redacta una respuesta inicial.",
    waits: "La primera respuesta al usuario.",
    result: "El usuario no espera en silencio. Tú revisas la clasificación y el tono antes de enviar.",
    tags: ["Correo", "Telegram", "Google Drive"],
  },
  {
    id: "diagnostico",
    title: "Reunir contexto antes de diagnosticar",
    before:
      "Antes de tocar un caso abres correo, CRM, documentación y capturas. Pierdes tiempo armando el contexto.",
    ask: "Cuando abra una incidencia, reúne el historial del cliente, los últimos mensajes y los documentos relacionados en un solo resumen.",
    does: "Consulta correo, CRM y archivos vinculados y deja un resumen listo para que empieces a diagnosticar.",
    waits: null,
    result: "Llegas al caso con el contexto montado. Es un aviso para ti: no necesita aprobación.",
    tags: ["Correo", "HubSpot", "Google Drive"],
  },
  {
    id: "escalado",
    title: "Preparar el traspaso cuando hay que escalar",
    before:
      "Al escalar copias hilos, adjuntas capturas y escribes a mano qué se ha probado. El siguiente nivel pierde tiempo reconstruyendo el caso.",
    ask: "Cuando haya que escalar, prepárame el resumen del caso, qué se ha intentado y el mensaje para el equipo de segundo nivel.",
    does: "Reúne el hilo, el historial y los pasos ya dados, y redacta el paquete de traspaso.",
    waits: "El envío al equipo interno (o la tarea creada).",
    result: "El escalado llega completo a la primera. Tú revisas y envías o asignas.",
    tags: ["Correo", "Telegram", "Google Docs"],
  },
]

// Herramientas que se pueden conectar hoy, agrupadas por para qué sirven.
export const TOOL_GROUPS: { title: string; tools: string[] }[] = [
  { title: "Correo y mensajes", tools: ["Tu correo (IMAP)", "WhatsApp", "Telegram"] },
  { title: "Archivos y documentos", tools: ["Google Drive", "Google Sheets", "Google Docs", "Excel en Drive"] },
  { title: "Agenda y clientes", tools: ["Google Calendar", "Google Contacts", "HubSpot"] },
  { title: "Tu sector", tools: ["Tokko Broker", "Xubio (solo lectura)"] },
  { title: "Redes y atención", tools: ["Buffer", "Asistente de voz en tu web"] },
  { title: "Inteligencia artificial", tools: ["OpenAI", "Anthropic", "DeepSeek", "Grok"] },
]
