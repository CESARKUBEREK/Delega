// Contenido del sitio público. Todo lo que se describe aquí existe en el
// producto (plantillas, conectores y aprobaciones); nada de cifras de ahorro
// ni testimonios inventados.

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
  {
    id: "correo",
    title: "Resumir los correos importantes y preparar respuestas",
    before: "Abres la bandeja, apartas boletines y avisos, y buscas a mano lo que de verdad espera respuesta.",
    ask: "Cada mañana, dime qué espera respuesta y déjame preparadas las respuestas urgentes.",
    does: "Ordena la bandeja: lo urgente arriba y los boletines aparte. Lee cada conversación y redacta la respuesta en el mismo hilo.",
    waits: "Cada respuesta, antes de enviarse.",
    result: "Empiezas el día con una lista corta de lo pendiente y los borradores listos para revisar.",
    tags: ["Correo", "Telegram", "WhatsApp"],
  },
  {
    id: "documentos",
    title: "Analizar documentos y extraer información",
    before: "Abres contratos, presupuestos o PDF uno a uno y copias fechas e importes en una planilla.",
    ask: "Lee los contratos de esta carpeta y apunta en la planilla la fecha de fin y el importe de cada uno.",
    does: "Lee los archivos que eliges en Drive (PDF, Word, Excel o Google Docs), saca los datos que pides y prepara las filas.",
    waits: "Las filas nuevas, con lo que había antes y lo que quedará.",
    result: "Los datos llegan a la planilla sin copiarlos a mano, y los revisas de un vistazo.",
    tags: ["Google Drive", "Google Sheets", "Excel"],
  },
  {
    id: "informes",
    title: "Crear informes automáticamente",
    before: "Cada viernes reúnes datos del CRM, la agenda y el correo para escribir el resumen de la semana.",
    ask: "Cada viernes a las 17:00, prepárame el informe de la semana con los negocios y las reuniones.",
    does: "Consulta el CRM y la agenda, redacta el informe y te lo envía. Si se lo pides, lo guarda como documento.",
    waits: "Crear el documento en tu Drive.",
    result: "El informe te llega a la hora fijada, aunque no estés delante del ordenador.",
    tags: ["HubSpot", "Google Calendar", "Google Docs"],
  },
  {
    id: "planillas",
    title: "Mantener las hojas de cálculo al día",
    before: "Cuando llega una factura, abres la planilla de gastos y escribes proveedor, fecha e importe.",
    ask: "Cuando llegue una factura por correo, añade una fila a la planilla de gastos con el proveedor, la fecha y el importe.",
    does: "Se pone en marcha con cada correo que encaje, lee la factura y prepara la fila en la hoja que elegiste.",
    waits: "Escribir la fila en la planilla.",
    result: "La planilla se mantiene al día sin que tengas que acordarte.",
    tags: ["Correo", "Google Sheets", "Excel"],
  },
  {
    id: "oportunidades",
    title: "Seguir las oportunidades comerciales",
    before: "Revisas el CRM para ver qué negocios se han parado y a quién no le has vuelto a escribir.",
    ask: "Los lunes, dime qué negocios llevan dos semanas sin moverse y prepárame un recordatorio para cada cliente.",
    does: "Repasa los negocios y sus etapas, detecta los parados y redacta un recordatorio para cada contacto.",
    waits: "Cada recordatorio y cada tarea nueva en el CRM.",
    result: "Ningún cliente se queda sin respuesta por despiste.",
    tags: ["HubSpot", "Correo"],
  },
  {
    id: "reuniones",
    title: "Preparar la información de cada reunión",
    before: "Antes de una reunión buscas la ficha del cliente, los últimos correos y en qué punto está el negocio.",
    ask: "Cada tarde, dime qué reuniones tengo mañana y qué sé de cada cliente.",
    does: "Lee la agenda del día siguiente y busca a cada asistente en tu CRM o en tus contactos.",
    waits: null,
    result: "Llegas a cada reunión sabiendo con quién hablas. Es un aviso para ti: no necesita aprobación.",
    tags: ["Google Calendar", "HubSpot", "Google Contacts"],
  },
  {
    id: "coordinar",
    title: "Coordinar el trabajo entre aplicaciones",
    before: "Un cliente pregunta por WhatsApp; buscas la propiedad, contestas, apuntas la consulta en el CRM y miras la agenda.",
    ask: "Cuando alguien pregunte por WhatsApp por una propiedad, búscala, contéstale con los datos y registra la consulta.",
    does: "Lee el mensaje, busca la propiedad, mira tus huecos libres y prepara la respuesta y el registro del contacto.",
    waits: "La respuesta al cliente y el registro en el CRM.",
    result: "Un solo paso tuyo (aprobar) en lugar de cuatro aplicaciones abiertas.",
    tags: ["WhatsApp", "Tokko Broker", "Google Calendar"],
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
