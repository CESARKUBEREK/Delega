import type { FlowPlan, PlanStep } from "@/lib/plan"

// Plantillas de automatización: planes listos para usar con las integraciones
// que ya funcionan. Al elegir una se crea un borrador en el espacio; la persona
// elige después los archivos, los filtros y la activa. Todo lo que escribe o
// envía espera aprobación, como cualquier otro flujo.

export type TemplateNeed = "ai" | "imap" | "telegram" | "whatsapp" | "google" | "calendar" | "contacts" | "hubspot" | "tokko" | "xubio" | "buffer" | "voice"

export type FlowTemplate = {
  id: string
  category: "Correo" | "WhatsApp" | "Telegram" | "CRM" | "Agenda" | "Informes" | "Avisos" | "Inmobiliaria" | "Clínica" | "Contabilidad" | "Redes" | "Tareas"
  plan: FlowPlan
  needs: TemplateNeed[]
  // Ajustes iniciales (filtros del correo).
  settings?: {
    email_filter?: { from: string[]; subject: string[]; words: string[]; skip_automatic: boolean }
    schedule?: { frequency: "daily" | "weekdays" | "weekly" | "monthly"; time: string; weekday: number; day_of_month: number }
  }
  // Qué tiene que hacer la persona después de crearla.
  setup: string
}

export const NEED_LABEL: Record<TemplateNeed, string> = {
  ai: "IA",
  imap: "Correo",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  google: "Google Drive",
  calendar: "Google Calendar",
  contacts: "Google Contacts",
  hubspot: "HubSpot",
  tokko: "Tokko Broker",
  xubio: "Xubio",
  buffer: "Buffer",
  voice: "Grok Voice",
}

function steps(list: Omit<PlanStep, "id">[]): PlanStep[] {
  return list.map((s, i) => ({ id: `s${i + 1}`, ...s }))
}

export const TEMPLATES: FlowTemplate[] = [
  {
    id: "control-vencimientos",
    category: "Avisos",
    needs: ["ai", "google"],
    settings: { schedule: { frequency: "weekly", time: "09:00", weekday: 1, day_of_month: 1 } },
    setup: "Elige la planilla de cobros, contratos, stock o vencimientos. Cada lunes a las 9:00 te avisa de lo que vence en los próximos 7 días.",
    plan: {
      version: 1,
      name: "Control de vencimientos",
      summary: "Cada lunes revisa tu planilla de vencimientos (cobros, contratos, seguros, stock) y te avisa de lo que vence esa semana o ya está vencido.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [{ kind: "spreadsheet", purpose: "Leer las fechas de vencimiento" }],
      steps: steps([
        { kind: "read", title: "Leer la planilla", description: "Ver sus hojas y columnas y leer las filas con fecha.", connection: "spreadsheet", requires_approval: false },
        { kind: "compare", title: "Buscar vencimientos", description: "Lo que vence en los próximos 7 días y lo ya vencido sin marcar como hecho o pagado.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Lista breve ordenada por fecha, con importe o detalle. Si no hay nada, no avisar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "volcado-semanal",
    category: "Informes",
    needs: ["ai", "google", "imap"],
    settings: { schedule: { frequency: "weekly", time: "18:00", weekday: 5, day_of_month: 1 } },
    setup: "Elige la planilla donde se guardan las cifras (una fila por semana). Cada viernes a las 18:00 propone la fila nueva; añadirla espera tu aprobación.",
    plan: {
      version: 1,
      name: "Cifras de la semana en una planilla",
      summary: "Cada viernes añade una fila a tu planilla con las cifras de la semana: correos recibidos por categoría, conversaciones sin responder y reuniones.",
      trigger: { type: "schedule", description: "Cada viernes a las 18:00" },
      connections: [
        { kind: "email", purpose: "Contar conversaciones de la semana" },
        { kind: "calendar", purpose: "Contar reuniones" },
        { kind: "spreadsheet", purpose: "Añadir la fila de la semana" },
      ],
      steps: steps([
        { kind: "read", title: "Leer la planilla", description: "Ver las columnas para respetar su orden.", connection: "spreadsheet", requires_approval: false },
        { kind: "read", title: "Bandeja de la semana", description: "Conversaciones de los últimos 7 días por categoría y cuántas siguen sin responder.", connection: "email", requires_approval: false },
        { kind: "read", title: "Reuniones", description: "Eventos de lunes a viernes, si el calendario está conectado.", connection: "calendar", requires_approval: false },
        { kind: "write", title: "Añadir la fila", description: "Una fila con la fecha y las cifras, en el orden de las columnas.", connection: "spreadsheet", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "consultas-propiedades",
    category: "Inmobiliaria",
    needs: ["ai", "imap", "tokko"],
    settings: {
      email_filter: {
        from: [],
        subject: [],
        words: ["propiedad", "departamento", "casa", "ph", "alquiler", "alquilar", "venta", "comprar", "visita", "tasación", "ambientes"],
        skip_automatic: true,
      },
    },
    setup: "Revisa las palabras que la lanzan y actívala. Cada respuesta y cada registro en Tokko esperan tu aprobación.",
    plan: {
      version: 1,
      name: "Responder consultas de propiedades",
      summary: "Cuando alguien pregunta por una propiedad por correo, la busca en Tokko, prepara la respuesta con las fichas que encajan y registra la consulta en Tokko.",
      trigger: { type: "email_message", description: "Al llegar un correo que pregunta por propiedades" },
      connections: [
        { kind: "email", purpose: "Leer la consulta y contestar en el mismo hilo" },
        { kind: "properties", purpose: "Buscar propiedades y registrar al interesado" },
      ],
      steps: steps([
        { kind: "read", title: "Entender qué busca", description: "Operación, tipo, zona, presupuesto y ambientes; si nombra una propiedad o un código, esa.", connection: "email", requires_approval: false },
        { kind: "read", title: "Buscar en Tokko", description: "Las propiedades disponibles que encajan (como mucho 5) y su ficha.", connection: "properties", requires_approval: false },
        { kind: "notify", title: "Responder", description: "Respuesta cordial con las propiedades que encajan (precio, ambientes, zona y enlace) y ofrecer una visita. Sin inventar datos. Si no hay ninguna, decirlo y pedir más detalles.", connection: "email", requires_approval: true },
        { kind: "write", title: "Registrar la consulta", description: "Registrar al interesado en Tokko con su correo, lo que busca y las propiedades enviadas.", connection: "properties", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "resumen-xubio",
    category: "Contabilidad",
    needs: ["ai", "xubio"],
    settings: { schedule: { frequency: "weekly", time: "09:00", weekday: 1, day_of_month: 1 } },
    setup: "Cada lunes a las 9:00 te avisa con el resumen de la semana anterior. Solo lee Xubio: no crea ni modifica nada.",
    plan: {
      version: 1,
      name: "Resumen semanal de facturación",
      summary: "Cada lunes te resume las facturas de venta y de compra de la semana anterior en Xubio: totales, principales clientes y proveedores.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [{ kind: "accounting", purpose: "Leer facturas de venta y de compra" }],
      steps: steps([
        { kind: "read", title: "Facturas de venta", description: "Las de lunes a domingo de la semana anterior.", connection: "accounting", requires_approval: false },
        { kind: "read", title: "Facturas de compra", description: "Las de la misma semana.", connection: "accounting", requires_approval: false },
        { kind: "generate", title: "Resumir", description: "Total facturado y comprado por moneda, número de comprobantes, principales clientes y proveedores, y lo que llame la atención.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Enviarte el resumen.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "correos-sin-responder",
    category: "Correo",
    needs: ["ai", "imap"],
    settings: { schedule: { frequency: "weekdays", time: "17:00", weekday: 1, day_of_month: 1 } },
    setup: "Cada día laborable a las 17:00 te avisa de lo pendiente y deja borradores; cada respuesta espera tu aprobación.",
    plan: {
      version: 1,
      name: "Correos sin responder",
      summary: "Busca las conversaciones de correo que llevan más de 48 horas sin respuesta, te avisa con la lista y deja preparada una respuesta para cada una.",
      trigger: { type: "schedule", description: "Días laborables a las 17:00" },
      connections: [{ kind: "email", purpose: "Leer la bandeja y responder en el mismo hilo" }],
      steps: steps([
        { kind: "read", title: "Buscar lo pendiente", description: "Conversaciones de correo de los últimos 14 días cuyo último mensaje es del contacto y tiene más de 48 horas. Ignorar publicidad y avisos automáticos.", connection: "email", requires_approval: false },
        { kind: "read", title: "Leer cada conversación", description: "Como mucho las 5 más importantes.", connection: "email", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Lista breve: quién, qué pide y desde cuándo.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Preparar respuestas", description: "Una respuesta para cada una en el mismo hilo; sin inventar datos, lo que falte entre corchetes.", connection: "email", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "agenda-manana",
    category: "Agenda",
    needs: ["ai", "calendar", "hubspot"],
    settings: { schedule: { frequency: "weekdays", time: "18:00", weekday: 1, day_of_month: 1 } },
    setup: "Cada día laborable a las 18:00 te avisa de las reuniones de mañana con la ficha de cada cliente.",
    plan: {
      version: 1,
      name: "Agenda de mañana",
      summary: "La tarde anterior te avisa de las reuniones del día siguiente, con lo que hay de cada cliente en HubSpot.",
      trigger: { type: "schedule", description: "Días laborables a las 18:00" },
      connections: [
        { kind: "calendar", purpose: "Ver las reuniones de mañana" },
        { kind: "crm", purpose: "Leer la ficha de cada cliente y sus negocios" },
      ],
      steps: steps([
        { kind: "read", title: "Reuniones de mañana", description: "Eventos del próximo día laborable con asistentes (el viernes, también los del fin de semana).", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Fichas del CRM", description: "Para cada asistente externo: contacto, empresa, negocios abiertos y última nota.", connection: "crm", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Para cada reunión: hora, con quién, en qué punto está y qué preparar. Si no hay reuniones, no avisar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "whatsapp-consultas",
    category: "WhatsApp",
    needs: ["ai", "whatsapp"],
    setup:
      "Elige (opcional) la carpeta de Drive con tus tarifas o preguntas frecuentes y actívala. Cada respuesta espera tu aprobación, en la app o en Telegram, y solo puede salir en las 24 horas siguientes al mensaje del cliente.",
    plan: {
      version: 1,
      name: "Atender WhatsApp de clientes",
      summary: "Cuando un cliente escribe por WhatsApp, entiende qué pide, busca la respuesta en tus documentos y te deja preparada la contestación para que la apruebes.",
      trigger: { type: "whatsapp_message", description: "Al recibir un WhatsApp de un cliente" },
      connections: [
        { kind: "whatsapp", purpose: "Leer el mensaje y responder a quien escribió" },
        { kind: "drive", purpose: "Tarifas, condiciones o preguntas frecuentes" },
      ],
      steps: steps([
        { kind: "read", title: "Entender el mensaje", description: "Qué pide o pregunta. Si es un saludo, un «gracias» o no necesita respuesta, terminar sin contestar.", connection: "whatsapp", requires_approval: false },
        { kind: "read", title: "Buscar la información", description: "En los archivos elegidos, lo relacionado con la consulta. Si no hay archivos, contestar solo con lo que se pueda sin inventar.", connection: "drive", requires_approval: false },
        { kind: "generate", title: "Redactar la respuesta", description: "Breve y cordial, como en un chat, sin Markdown. Lo que falte, entre corchetes para completarlo.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Responder por WhatsApp", description: "Enviar la respuesta a quien escribió.", connection: "whatsapp", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "whatsapp-al-crm",
    category: "WhatsApp",
    needs: ["ai", "whatsapp", "hubspot"],
    setup: "Actívala y cada persona nueva que te escriba por WhatsApp se propondrá como contacto en HubSpot, con una nota de lo que pide. Crear el contacto espera tu aprobación.",
    plan: {
      version: 1,
      name: "Contactos de WhatsApp a HubSpot",
      summary: "Si te escribe por WhatsApp alguien que no está en tu CRM, propone crearlo en HubSpot con su teléfono y una nota de lo que pide.",
      trigger: { type: "whatsapp_message", description: "Al recibir un WhatsApp" },
      connections: [
        { kind: "whatsapp", purpose: "Leer el mensaje" },
        { kind: "crm", purpose: "Buscar y crear el contacto" },
      ],
      steps: steps([
        { kind: "read", title: "Buscar en HubSpot", description: "Buscar el contacto por su teléfono y por su nombre. Si ya existe, terminar.", connection: "crm", requires_approval: false },
        { kind: "write", title: "Crear el contacto", description: "Nombre (el de su perfil de WhatsApp) y teléfono.", connection: "crm", requires_approval: true },
        { kind: "write", title: "Añadir una nota", description: "Qué pide, en una o dos frases, con la fecha.", connection: "crm", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "responder-consultas",
    category: "Correo",
    needs: ["ai", "imap", "google"],
    settings: { email_filter: { from: [], subject: [], words: [], skip_automatic: true } },
    setup: "Elige la carpeta de Drive con tus tarifas, condiciones o preguntas frecuentes y, si quieres, filtra qué correos la lanzan.",
    plan: {
      version: 1,
      name: "Responder consultas de clientes",
      summary: "Cuando llega una consulta por correo, busca la respuesta en tus documentos de Drive y deja preparada la contestación para que la apruebes.",
      trigger: { type: "email_message", description: "Al llegar un correo de un cliente con una consulta" },
      connections: [
        { kind: "email", purpose: "Leer la consulta y contestar en el mismo hilo" },
        { kind: "drive", purpose: "Buscar la información en tus documentos (tarifas, condiciones, preguntas frecuentes)" },
      ],
      steps: steps([
        { kind: "read", title: "Leer el correo", description: "Entender qué pregunta o pide el remitente. Si no es una consulta (publicidad, un aviso), terminar sin hacer nada.", connection: "email", requires_approval: false },
        { kind: "read", title: "Buscar en tus documentos", description: "Leer los archivos de la carpeta elegida que tengan relación con la consulta.", connection: "drive", requires_approval: false },
        { kind: "generate", title: "Redactar la respuesta", description: "Contestar solo con datos que aparezcan en los documentos; lo que falte, entre corchetes para completarlo.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Enviar la respuesta", description: "Responder al remitente en el mismo hilo.", connection: "email", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "pedidos-a-planilla",
    category: "Correo",
    needs: ["ai", "imap", "google"],
    settings: { email_filter: { from: [], subject: [], words: ["pedido", "solicitud", "reserva", "encargo"], skip_automatic: true } },
    setup: "Elige la planilla (Google Sheets o Excel) donde se apuntan los pedidos y revisa las palabras que la lanzan.",
    plan: {
      version: 1,
      name: "Apuntar pedidos en una planilla",
      summary: "Cada pedido, reserva o solicitud que llega por correo se apunta como una fila nueva en tu planilla.",
      trigger: { type: "email_message", description: "Al llegar un correo con un pedido, una reserva o una solicitud" },
      connections: [
        { kind: "email", purpose: "Leer el pedido" },
        { kind: "spreadsheet", purpose: "Añadir una fila por pedido" },
      ],
      steps: steps([
        { kind: "read", title: "Leer la planilla", description: "Ver las columnas de la planilla para respetar su orden y formato.", connection: "spreadsheet", requires_approval: false },
        { kind: "transform", title: "Sacar los datos del correo", description: "Fecha, cliente, contacto, qué pide, cantidades, importes y fechas de entrega, si aparecen.", connection: "email", requires_approval: false },
        { kind: "write", title: "Añadir la fila", description: "Añadir una fila al final con los datos en el orden de las columnas; lo que no aparezca, vacío.", connection: "spreadsheet", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "contacto-al-crm",
    category: "CRM",
    needs: ["ai", "imap", "hubspot"],
    settings: { email_filter: { from: [], subject: [], words: [], skip_automatic: true } },
    setup: "Filtra qué correos la lanzan (por ejemplo, los del formulario de tu web) para no crear contactos de proveedores.",
    plan: {
      version: 1,
      name: "Pasar contactos nuevos al CRM",
      summary: "Cuando escribe alguien que no está en HubSpot, propone crear el contacto con una nota del primer mensaje.",
      trigger: { type: "email_message", description: "Al llegar un correo de alguien nuevo" },
      connections: [
        { kind: "email", purpose: "Leer quién escribe y qué quiere" },
        { kind: "crm", purpose: "Buscar el contacto y crearlo si no existe" },
      ],
      steps: steps([
        { kind: "read", title: "Buscar el contacto", description: "Buscar en HubSpot la dirección del remitente.", connection: "crm", requires_approval: false },
        { kind: "condition", title: "¿Ya existe?", description: "Si ya está en HubSpot, solo añadir una nota con el resumen del correo.", connection: "none", requires_approval: false },
        { kind: "write", title: "Crear el contacto", description: "Crear el contacto con nombre, correo, empresa y teléfono si aparecen en la firma.", connection: "crm", requires_approval: true },
        { kind: "write", title: "Añadir una nota", description: "Nota con el resumen de lo que pide.", connection: "crm", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "proponer-cita",
    category: "Agenda",
    needs: ["ai", "imap", "calendar"],
    settings: { email_filter: { from: [], subject: [], words: ["reunión", "reunion", "cita", "visita", "quedar", "llamada"], skip_automatic: true } },
    setup: "Revisa las palabras que la lanzan. En «Citas en tu calendario» eliges si la cita espera tu aprobación o se reserva directamente cuando la hora está libre (y se invita a quien la pidió).",
    plan: {
      version: 1,
      name: "Proponer cita a quien la pide",
      summary: "Cuando alguien pide una reunión o una visita por correo, mira tu agenda y le contesta con huecos libres.",
      trigger: { type: "email_message", description: "Al llegar un correo que pide una reunión, una visita o una llamada" },
      connections: [
        { kind: "email", purpose: "Leer la petición y contestar" },
        { kind: "calendar", purpose: "Consultar los huecos libres y crear el evento" },
      ],
      steps: steps([
        { kind: "read", title: "Leer la petición", description: "Qué tipo de cita, duración y fechas o franjas que propone.", connection: "email", requires_approval: false },
        { kind: "read", title: "Mirar la agenda", description: "Eventos de los próximos 7 días laborables para encontrar 3 huecos libres en horario de trabajo.", connection: "calendar", requires_approval: false },
        { kind: "notify", title: "Proponer los huecos", description: "Responder en el mismo hilo con las 3 opciones.", connection: "email", requires_approval: true },
        { kind: "write", title: "Reservar si ya hay fecha", description: "Si el correo ya fija una fecha que está libre, crear el evento invitando a quien la pidió (con tu aprobación o directamente, según elijas).", connection: "calendar", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "incidencias-telegram",
    category: "Telegram",
    needs: ["ai", "telegram", "google"],
    setup: "Elige la planilla de incidencias. El bot contestará a quien escriba, siempre con tu aprobación.",
    plan: {
      version: 1,
      name: "Registrar incidencias por Telegram",
      summary: "Quien escribe al bot (clientes, equipo de obra) deja una incidencia: se apunta en la planilla y se le confirma la recepción.",
      trigger: { type: "telegram_message", description: "Al recibir un mensaje en el bot de Telegram" },
      connections: [
        { kind: "telegram", purpose: "Leer la incidencia y confirmar" },
        { kind: "spreadsheet", purpose: "Apuntar la incidencia" },
      ],
      steps: steps([
        { kind: "read", title: "Leer la planilla", description: "Ver las columnas de la planilla de incidencias.", connection: "spreadsheet", requires_approval: false },
        { kind: "transform", title: "Ordenar la incidencia", description: "Quién, dónde, qué pasa y urgencia (alta, media o baja).", connection: "telegram", requires_approval: false },
        { kind: "write", title: "Apuntarla", description: "Añadir una fila con fecha, remitente y los datos.", connection: "spreadsheet", requires_approval: true },
        { kind: "notify", title: "Confirmar", description: "Responder por Telegram que se ha recibido.", connection: "telegram", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "preparar-reunion",
    category: "Agenda",
    needs: ["ai", "calendar", "hubspot", "google"],
    setup: "Ejecútala cuando quieras desde aquí o pídela en el chat: «prepárame la reunión de mañana con García».",
    plan: {
      version: 1,
      name: "Preparar una reunión",
      summary: "Reúne en un documento lo que sabes del cliente antes de una reunión: ficha del CRM, negocios abiertos y el evento de la agenda.",
      trigger: { type: "manual", description: "Cuando lo pidas, antes de una reunión" },
      connections: [
        { kind: "calendar", purpose: "Encontrar la reunión y sus asistentes" },
        { kind: "crm", purpose: "Leer la ficha del cliente y sus negocios" },
        { kind: "documents", purpose: "Crear el documento de preparación" },
      ],
      steps: steps([
        { kind: "read", title: "Encontrar la reunión", description: "Buscar en la agenda la próxima reunión indicada (o la del día siguiente) y sus asistentes.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Leer el CRM", description: "Ficha del contacto y de su empresa, negocios abiertos, etapa y últimas notas.", connection: "crm", requires_approval: false },
        { kind: "generate", title: "Resumir", description: "Quién es, en qué punto está, temas pendientes y preguntas sugeridas.", connection: "none", requires_approval: false },
        { kind: "write", title: "Crear el documento", description: "Crear un documento «Preparación – cliente – fecha».", connection: "documents", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "informe-semanal",
    category: "Informes",
    needs: ["ai", "calendar", "hubspot", "google"],
    settings: { schedule: { frequency: "weekly", time: "17:00", weekday: 5, day_of_month: 1 } },
    setup: "Se ejecuta los viernes a las 17:00 (puedes cambiarlo). Te llega el informe; crear el documento espera tu aprobación.",
    plan: {
      version: 1,
      name: "Informe de la semana",
      summary: "Resume la semana: reuniones hechas, negocios nuevos y los que cambiaron de etapa, los parados, el importe abierto y las tareas vencidas. Te lo envía y, si quieres, lo guarda en un documento.",
      trigger: { type: "schedule", description: "Cada viernes a las 17:00" },
      connections: [
        { kind: "calendar", purpose: "Reuniones de la semana" },
        { kind: "crm", purpose: "Negocios y tareas" },
        { kind: "documents", purpose: "Crear el informe" },
      ],
      steps: steps([
        { kind: "read", title: "Reuniones", description: "Eventos de lunes a viernes de esta semana.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Etapas", description: "Pipelines y etapas de los negocios.", connection: "crm", requires_approval: false },
        { kind: "read", title: "Negocios y tareas", description: "Negocios abiertos con su etapa, importe y fecha de última modificación, y tareas pendientes o vencidas.", connection: "crm", requires_approval: false },
        { kind: "generate", title: "Redactar el informe", description: "Resumen breve: reuniones hechas, negocios nuevos de la semana, cambios de etapa, parados más de 14 días, importe total abierto, tareas vencidas y lo pendiente para la semana que viene.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Enviarte el informe.", connection: "none", requires_approval: false },
        { kind: "write", title: "Crear el documento", description: "Crear «Informe semanal – fecha». Si solo quieres el aviso, rechaza este paso.", connection: "documents", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "secretaria-digital",
    category: "Avisos",
    needs: ["ai", "imap", "calendar"],
    settings: { schedule: { frequency: "weekdays", time: "08:00", weekday: 1, day_of_month: 1 } },
    setup: "Te llega cada día laborable a las 8:00, sin aprobación. Si tienes HubSpot o una planilla de tareas conectados, también los revisa.",
    plan: {
      version: 1,
      name: "Mi secretaria digital",
      summary: "Cada mañana te prepara el día: mensajes importantes, citas, clientes que esperan respuesta, tareas vencidas y lo que espera tu aprobación, con acciones recomendadas.",
      trigger: { type: "schedule", description: "Días laborables a las 8:00" },
      connections: [
        { kind: "email", purpose: "Mensajes de las últimas 24 horas y quién espera respuesta" },
        { kind: "calendar", purpose: "Citas de hoy" },
        { kind: "crm", purpose: "Tareas vencidas y negocios que necesitan algo (si HubSpot está conectado)" },
      ],
      steps: steps([
        { kind: "read", title: "Revisar la bandeja", description: "Conversaciones de correo, WhatsApp y Telegram de las últimas 24 horas; marcar las urgentes y las de clientes que esperan respuesta hace más de 24 horas.", connection: "email", requires_approval: false },
        { kind: "read", title: "Mirar la agenda", description: "Citas de hoy con hora, con quién y dónde.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Tareas y clientes", description: "Si HubSpot está conectado: tareas vencidas o de hoy y negocios sin movimiento desde hace más de 14 días.", connection: "crm", requires_approval: false },
        { kind: "generate", title: "Preparar el día", description: "En este orden: lo urgente, citas de hoy, clientes que esperan respuesta, tareas, 3 acciones recomendadas y, al final, en tres líneas como mucho, lo que importe de los boletines y avisos automáticos. Pocas líneas.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Enviártelo", description: "Mandarte el resumen.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "seguimiento-clientes",
    category: "CRM",
    needs: ["ai", "imap", "hubspot"],
    settings: { schedule: { frequency: "weekdays", time: "09:30", weekday: 1, day_of_month: 1 } },
    setup: "Cada día laborable a las 9:30. Crear contactos, tareas y enviar correos espera tu aprobación; solo escribe a contactos autorizados.",
    plan: {
      version: 1,
      name: "Seguimiento automático de clientes",
      summary: "Cada mañana detecta oportunidades: consultas sin responder, personas nuevas que no están en el CRM y negocios parados. Propone el contacto, el seguimiento y la tarea de cada uno.",
      trigger: { type: "schedule", description: "Días laborables a las 9:30" },
      connections: [
        { kind: "email", purpose: "Consultas de clientes y seguimientos" },
        { kind: "crm", purpose: "Contactos, negocios y tareas" },
      ],
      steps: steps([
        { kind: "read", title: "Consultas sin responder", description: "Conversaciones de los últimos 7 días cuyo último mensaje es de un cliente y lleva más de 24 horas sin respuesta. Ignorar publicidad y avisos.", connection: "email", requires_approval: false },
        { kind: "read", title: "¿Están en el CRM?", description: "Buscar en HubSpot a cada remitente por correo o teléfono.", connection: "crm", requires_approval: false },
        { kind: "write", title: "Registrar contactos nuevos", description: "Si alguien con interés comercial no está en HubSpot, crearlo con una nota de lo que pide (máximo 5).", connection: "crm", requires_approval: true },
        { kind: "read", title: "Negocios parados", description: "Negocios abiertos sin cambios desde hace más de 14 días (máximo 5).", connection: "crm", requires_approval: false },
        { kind: "notify", title: "Seguimientos", description: "Un correo breve y cordial para cada consulta pendiente o negocio parado, en el mismo hilo si existe.", connection: "email", requires_approval: true },
        { kind: "write", title: "Próxima acción", description: "Una tarea en HubSpot para dentro de 3 días en cada caso.", connection: "crm", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Lista de oportunidades de hoy y lo que queda por aprobar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "presupuesto",
    category: "Correo",
    needs: ["ai", "imap", "google"],
    settings: { email_filter: { from: [], subject: [], words: ["presupuesto", "cotización", "cotizacion", "precio", "tarifa", "propuesta"], skip_automatic: true } },
    setup: "Elige tu planilla o documento de precios y, si quieres, una plantilla de presupuesto en Drive. Crear el documento y responder al cliente esperan tu aprobación.",
    plan: {
      version: 1,
      name: "Presupuestos y propuestas",
      summary: "Cuando alguien pide un presupuesto por correo, consulta tus precios y antecedentes, prepara el presupuesto en Google Docs y redacta la respuesta al cliente.",
      trigger: { type: "email_message", description: "Al llegar un correo que pide un presupuesto, un precio o una propuesta" },
      connections: [
        { kind: "email", purpose: "Leer la solicitud y responder" },
        { kind: "spreadsheet", purpose: "Consultar la lista de precios" },
        { kind: "documents", purpose: "Crear el presupuesto" },
      ],
      steps: steps([
        { kind: "read", title: "Entender la solicitud", description: "Qué pide, cantidades, plazos y datos del cliente. Si no es una solicitud de presupuesto, terminar.", connection: "email", requires_approval: false },
        { kind: "read", title: "Consultar precios", description: "Buscar en la planilla o documento de precios lo que corresponde a cada concepto.", connection: "spreadsheet", requires_approval: false },
        { kind: "generate", title: "Preparar el presupuesto", description: "Conceptos, cantidades, precio unitario, total, plazo y validez. Lo que no esté en tus precios, entre corchetes para completarlo; no inventar precios.", connection: "none", requires_approval: false },
        { kind: "write", title: "Crear el documento", description: "Crear «Presupuesto – cliente – fecha» en Google Docs.", connection: "documents", requires_approval: true },
        { kind: "notify", title: "Responder al cliente", description: "Respuesta en el mismo hilo con el presupuesto en el cuerpo del correo y una despedida cordial.", connection: "email", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "redes-sociales",
    category: "Redes",
    needs: ["ai", "buffer"],
    settings: { schedule: { frequency: "weekly", time: "10:00", weekday: 1, day_of_month: 1 } },
    setup: "Conecta Buffer y, si quieres, elige en Drive un documento de novedades o ideas. Cada lunes propone las publicaciones de la semana; cada una espera tu aprobación.",
    plan: {
      version: 1,
      name: "Gestor de redes sociales",
      summary: "Cada lunes prepara 3 publicaciones para la semana a partir de tus novedades o documentos, adaptadas a cada red, y las deja programadas en Buffer cuando las apruebas.",
      trigger: { type: "schedule", description: "Cada lunes a las 10:00" },
      connections: [
        { kind: "social", purpose: "Ver tus canales y programar las publicaciones" },
        { kind: "drive", purpose: "Novedades, servicios o ideas de contenido (opcional)" },
      ],
      steps: steps([
        { kind: "read", title: "Ver los canales", description: "Redes conectadas en Buffer.", connection: "social", requires_approval: false },
        { kind: "read", title: "Buscar de qué hablar", description: "Novedades, servicios o ideas en los documentos elegidos. Si no hay, usar temas útiles para los clientes del negocio.", connection: "drive", requires_approval: false },
        { kind: "generate", title: "Redactar", description: "3 publicaciones distintas, adaptadas a cada red (más cortas en X, sin enlaces en el texto de Instagram), sin inventar ofertas ni precios.", connection: "none", requires_approval: false },
        { kind: "write", title: "Programarlas", description: "Martes, jueves y sábado a las 10:00, en los canales que encajen.", connection: "social", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "control-facturas",
    category: "Contabilidad",
    needs: ["ai", "google"],
    settings: { schedule: { frequency: "weekly", time: "09:00", weekday: 1, day_of_month: 1 } },
    setup: "Elige en Drive la carpeta donde guardas las facturas (PDF) y la planilla de registro. Cada lunes apunta las nuevas; añadir filas espera tu aprobación.",
    plan: {
      version: 1,
      name: "Control de facturas y gastos",
      summary: "Cada lunes lee las facturas nuevas de tu carpeta de Drive, saca proveedor, número, fechas e importes, las apunta en tu planilla y te avisa de duplicados, vencimientos e incoherencias.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [
        { kind: "drive", purpose: "Leer las facturas de la carpeta" },
        { kind: "spreadsheet", purpose: "Registro de facturas y gastos" },
      ],
      steps: steps([
        { kind: "read", title: "Leer el registro", description: "Columnas de la planilla y facturas ya apuntadas.", connection: "spreadsheet", requires_approval: false },
        { kind: "read", title: "Facturas nuevas", description: "Archivos de la carpeta modificados en los últimos 7 días (máximo 15).", connection: "drive", requires_approval: false },
        { kind: "transform", title: "Sacar los datos", description: "Proveedor, número, fecha, vencimiento, base, impuestos y total de cada factura.", connection: "none", requires_approval: false },
        { kind: "compare", title: "Revisar", description: "Duplicados (mismo proveedor y número, o mismo importe y fecha), las que ya están apuntadas, vencimientos en 15 días y totales que no cuadran.", connection: "none", requires_approval: false },
        { kind: "write", title: "Apuntarlas", description: "Una fila por factura nueva, en el orden de las columnas; las dudosas, marcadas en una columna de observaciones si existe.", connection: "spreadsheet", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Cuántas apuntó, posibles duplicados, vencimientos próximos e incoherencias.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "coordinador-tareas",
    category: "Tareas",
    needs: ["ai", "imap", "google"],
    settings: { schedule: { frequency: "weekdays", time: "18:30", weekday: 1, day_of_month: 1 } },
    setup: "Elige la planilla de tareas (columnas sugeridas: Tarea, Origen, Prioridad, Fecha límite, Estado). Cada tarde propone las tareas nuevas; añadirlas espera tu aprobación.",
    plan: {
      version: 1,
      name: "Coordinador de tareas",
      summary: "Cada tarde convierte en tareas lo que te piden por correo, WhatsApp o Telegram y lo que acordaste en tus reuniones: propone prioridad y fecha, las apunta en tu planilla y te recuerda las vencidas.",
      trigger: { type: "schedule", description: "Días laborables a las 18:30" },
      connections: [
        { kind: "email", purpose: "Peticiones y compromisos del día" },
        { kind: "calendar", purpose: "Reuniones de hoy (si está conectado)" },
        { kind: "spreadsheet", purpose: "Lista de tareas" },
      ],
      steps: steps([
        { kind: "read", title: "Leer la lista de tareas", description: "Columnas y tareas abiertas, para no duplicar.", connection: "spreadsheet", requires_approval: false },
        { kind: "read", title: "Mensajes del día", description: "Conversaciones de hoy con peticiones, encargos o compromisos («te lo envío», «¿me puedes…?»).", connection: "email", requires_approval: false },
        { kind: "read", title: "Reuniones de hoy", description: "Si el calendario está conectado, las reuniones del día y su descripción.", connection: "calendar", requires_approval: false },
        { kind: "transform", title: "Convertir en tareas", description: "Una tarea por compromiso, con origen, prioridad (alta, media o baja) y fecha límite propuesta. Sin duplicar las que ya están.", connection: "none", requires_approval: false },
        { kind: "write", title: "Apuntarlas", description: "Añadir las tareas nuevas al final de la planilla.", connection: "spreadsheet", requires_approval: true },
        { kind: "notify", title: "Recordatorio", description: "Tareas nuevas de hoy y las abiertas que vencen mañana o ya vencieron.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  // -------------------------------------------------------------------------
  // Plantillas de los sectores (inmobiliarias, clínicas y profesionales).
  // -------------------------------------------------------------------------
  {
    id: "seguimiento-visitas",
    category: "Inmobiliaria",
    needs: ["ai", "imap", "calendar"],
    settings: { schedule: { frequency: "weekdays", time: "19:00", weekday: 1, day_of_month: 1 } },
    setup: "Cada tarde busca en tu agenda las visitas del día (eventos con «visita» en el título). Cada correo de seguimiento espera tu aprobación.",
    plan: {
      version: 1,
      name: "Seguimiento de visitas",
      summary: "Cada tarde, a quien visitó una propiedad hoy le escribe para saber qué le pareció y ofrecerle otras opciones o una segunda visita.",
      trigger: { type: "schedule", description: "Días laborables a las 19:00" },
      connections: [
        { kind: "calendar", purpose: "Visitas de hoy" },
        { kind: "email", purpose: "Conversación con cada interesado" },
        { kind: "properties", purpose: "Propiedades parecidas, si Tokko está conectado" },
      ],
      steps: steps([
        { kind: "read", title: "Visitas de hoy", description: "Eventos de hoy con «visita» en el título, con la propiedad y el interesado.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Conversación del interesado", description: "Buscar en la bandeja la conversación con cada interesado. Si no hay, dejarlo en el aviso final.", connection: "email", requires_approval: false },
        { kind: "read", title: "Propiedades parecidas", description: "Si Tokko está conectado, hasta 3 propiedades disponibles parecidas a la visitada (zona, precio, ambientes).", connection: "properties", requires_approval: false },
        { kind: "notify", title: "Escribir a cada interesado", description: "En su mismo hilo: agradecer la visita, preguntar qué le pareció y ofrecer las alternativas o una segunda visita. Sin inventar datos.", connection: "email", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Lista de visitas de hoy y a quién no se pudo escribir. Si no hubo visitas, no avisar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "propiedades-nuevas",
    category: "Inmobiliaria",
    needs: ["ai", "tokko", "imap"],
    settings: { schedule: { frequency: "weekly", time: "10:00", weekday: 1, day_of_month: 1 } },
    setup: "Cada lunes cruza las propiedades nuevas de Tokko con lo que pidieron tus interesados en la bandeja (últimos 60 días). Cada correo espera tu aprobación.",
    plan: {
      version: 1,
      name: "Propiedades nuevas para tus interesados",
      summary: "Cada lunes busca en Tokko las propiedades que entraron en la semana y avisa a los interesados cuya búsqueda encaja.",
      trigger: { type: "schedule", description: "Cada lunes a las 10:00" },
      connections: [
        { kind: "properties", purpose: "Propiedades nuevas" },
        { kind: "email", purpose: "Qué busca cada interesado y escribirle" },
      ],
      steps: steps([
        { kind: "read", title: "Propiedades nuevas", description: "Propiedades disponibles dadas de alta en los últimos 7 días, con operación, zona, precio y ambientes.", connection: "properties", requires_approval: false },
        { kind: "read", title: "Qué buscan tus interesados", description: "Conversaciones de la bandeja de los últimos 60 días con consultas de compra o alquiler: operación, zona, presupuesto y ambientes.", connection: "email", requires_approval: false },
        { kind: "compare", title: "Cruzar", description: "Para cada interesado, las propiedades nuevas que encajan con lo que pidió (como mucho 3 por persona y 10 personas).", connection: "none", requires_approval: false },
        { kind: "notify", title: "Escribir a cada interesado", description: "En su mismo hilo, con las propiedades que encajan (precio, zona, ambientes y enlace) y ofreciendo una visita.", connection: "email", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Resumen: propiedades nuevas y a quién se le ofrecieron.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "recordatorio-citas",
    category: "Clínica",
    needs: ["ai", "imap", "calendar"],
    settings: { schedule: { frequency: "weekdays", time: "18:00", weekday: 1, day_of_month: 1 } },
    setup:
      "Cada tarde recuerda las citas de mañana a los pacientes con correo en la cita (como invitados) o con una conversación en la bandeja. Sin datos clínicos. Cada recordatorio espera tu aprobación; puedes aprobarlos todos desde Aprobaciones.",
    plan: {
      version: 1,
      name: "Recordatorio de citas",
      summary: "Cada tarde envía a cada paciente un recordatorio de su cita de mañana, con la hora, la dirección y cómo cambiarla. Menos ausencias, sin llamar uno a uno.",
      trigger: { type: "schedule", description: "Días laborables a las 18:00" },
      connections: [
        { kind: "calendar", purpose: "Citas de mañana" },
        { kind: "email", purpose: "Recordatorio a cada paciente" },
      ],
      steps: steps([
        { kind: "read", title: "Citas de mañana", description: "Eventos del día siguiente con su hora, lugar y el paciente (invitado o nombre en el título).", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Correo de cada paciente", description: "El correo del invitado o, si no lo hay, su conversación en la bandeja. Sin correo, dejarlo en el aviso final.", connection: "email", requires_approval: false },
        { kind: "notify", title: "Recordatorio", description: "Breve y cordial: día, hora, dirección y que responda a este correo si necesita cambiarla. Nunca incluir el motivo de la consulta ni datos de salud.", connection: "email", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Cuántas citas hay mañana y a quién no se pudo avisar. Si no hay citas, no avisar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "seguimiento-consulta",
    category: "Clínica",
    needs: ["ai", "imap", "calendar"],
    settings: { schedule: { frequency: "weekdays", time: "19:30", weekday: 1, day_of_month: 1 } },
    setup: "Puedes elegir un documento con las indicaciones generales que das después de la consulta y el enlace a tu encuesta o a tus reseñas. Sin datos clínicos.",
    plan: {
      version: 1,
      name: "Seguimiento tras la consulta",
      summary: "Cada tarde escribe a los pacientes atendidos hoy: gracias por venir, indicaciones generales y, si quieres, el enlace para valorar la atención.",
      trigger: { type: "schedule", description: "Días laborables a las 19:30" },
      connections: [
        { kind: "calendar", purpose: "Citas de hoy" },
        { kind: "documents", purpose: "Indicaciones y enlace de valoración" },
        { kind: "email", purpose: "Mensaje a cada paciente" },
      ],
      steps: steps([
        { kind: "read", title: "Citas de hoy", description: "Eventos de hoy con el paciente (invitado o nombre en el título).", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Tus indicaciones", description: "Si elegiste un documento, las indicaciones generales y el enlace de valoración.", connection: "documents", requires_approval: false },
        { kind: "notify", title: "Mensaje de seguimiento", description: "Agradecer la visita, recordar las indicaciones generales y, si hay enlace, pedir la valoración. Sin diagnósticos, tratamientos ni datos de salud.", connection: "email", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
  {
    id: "alta-cliente",
    category: "CRM",
    needs: ["ai", "imap", "contacts"],
    settings: { email_filter: { from: [], subject: [], words: [], skip_automatic: true } },
    setup: "Para quien no usa un CRM: da de alta en Google Contacts a quien te escribe por primera vez con una consulta de trabajo. Añadir el contacto espera tu aprobación.",
    plan: {
      version: 1,
      name: "Alta de cliente nuevo",
      summary: "Cuando te escribe alguien nuevo con una consulta de trabajo, lo guarda en tus contactos de Google con sus datos de la firma y una nota de lo que pide.",
      trigger: { type: "email_message", description: "Al llegar un correo de alguien nuevo" },
      connections: [
        { kind: "email", purpose: "Leer el correo" },
        { kind: "contacts", purpose: "Buscar y crear el contacto" },
      ],
      steps: steps([
        { kind: "read", title: "Leer el correo", description: "Si no es una consulta de trabajo (publicidad, un aviso, algo personal), terminar sin hacer nada.", connection: "email", requires_approval: false },
        { kind: "read", title: "¿Ya está en tus contactos?", description: "Buscar al remitente por su correo en Google Contacts. Si ya está, terminar.", connection: "contacts", requires_approval: false },
        { kind: "write", title: "Crear el contacto", description: "Nombre, correo, teléfono y empresa si aparecen en la firma, y una nota con lo que pide y la fecha.", connection: "contacts", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
]

export function findTemplate(id: string): FlowTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

// ---------------------------------------------------------------------------
// Rutinas: cómo se presentan las plantillas. Cada rutina resuelve un problema
// del negocio y agrupa sus plantillas (la primera es la principal).
// ---------------------------------------------------------------------------
export type RoutineTier = "personal" | "negocio" | "avanzado"

export const TIER_INFO: Record<RoutineTier, { title: string; promise: string }> = {
  personal: { title: "Para organizar tu día", promise: "Recupera tiempo y organiza tu jornada." },
  negocio: { title: "Para tu negocio", promise: "Automatiza la gestión y vende más." },
  avanzado: { title: "Avanzado", promise: "Un empleado digital para tu negocio." },
}

export type Routine = {
  id: string
  number: number
  title: string
  tier: RoutineTier
  problem: string
  needs: TemplateNeed[]
  reads: string
  auto: string
  approval: string
  saves: string
  templates: string[]
  // Rutinas que no son una plantilla: se activan en otra pantalla.
  link?: { label: string; path: string }
}

export const ROUTINES: Routine[] = [
  {
    id: "bandeja",
    number: 1,
    title: "Bandeja inteligente",
    tier: "personal",
    problem: "Los mensajes llegan por correo, WhatsApp, Telegram y teléfono, y alguno se pierde.",
    needs: ["ai", "imap", "whatsapp", "telegram"],
    reads: "Tus conversaciones de correo, WhatsApp, Telegram y llamadas.",
    auto: "Clasifica, detecta urgencias, identifica al cliente y resume cada conversación.",
    approval: "Cada respuesta que prepara antes de enviarse.",
    saves: "Revisar y ordenar mensajes a mano: suele ser cerca de una hora al día.",
    templates: ["correos-sin-responder", "responder-consultas", "whatsapp-consultas"],
    link: { label: "Abrir la Bandeja", path: "bandeja" },
  },
  {
    id: "secretaria",
    number: 2,
    title: "Mi secretaria digital",
    tier: "personal",
    problem: "Empezar el día sin saber qué es lo urgente.",
    needs: ["ai", "imap", "calendar"],
    reads: "Bandeja, agenda y, si están conectados, CRM y tareas.",
    auto: "Cada mañana te envía el día ordenado con acciones recomendadas.",
    approval: "Nada: solo te avisa a ti.",
    saves: "Repasar correo, agenda y pendientes cada mañana.",
    templates: ["secretaria-digital"],
  },
  {
    id: "seguimiento",
    number: 3,
    title: "Seguimiento automático de clientes",
    tier: "negocio",
    problem: "Consultas sin responder y clientes que se enfrían por falta de seguimiento.",
    needs: ["ai", "imap", "hubspot"],
    reads: "Bandeja y contactos, negocios y tareas de HubSpot.",
    auto: "Detecta oportunidades, consultas pendientes y negocios parados.",
    approval: "Crear contactos y tareas, y cada correo de seguimiento.",
    saves: "Repasar el CRM y escribir seguimientos uno a uno; y clientes que no se pierden.",
    templates: ["seguimiento-clientes", "contacto-al-crm", "whatsapp-al-crm"],
  },
  {
    id: "agenda",
    number: 4,
    title: "Agenda inteligente",
    tier: "personal",
    problem: "Idas y vueltas de mensajes para cuadrar una cita, y reuniones sin preparar.",
    needs: ["ai", "calendar", "imap"],
    reads: "Tu calendario y las peticiones de cita.",
    auto: "Busca huecos libres y te prepara las reuniones del día siguiente.",
    approval: "Proponer horarios al cliente. Las citas: con tu aprobación o reservadas directamente si la hora está libre, como elijas.",
    saves: "Cada cita cuadrada sin intercambiar varios mensajes.",
    templates: ["proponer-cita", "agenda-manana", "preparar-reunion"],
  },
  {
    id: "presupuestos",
    number: 5,
    title: "Presupuestos y propuestas",
    tier: "negocio",
    problem: "Tardar días en responder a una petición de presupuesto.",
    needs: ["ai", "imap", "google"],
    reads: "La solicitud, tu lista de precios y los antecedentes del cliente.",
    auto: "Prepara el presupuesto y la respuesta.",
    approval: "Crear el documento y enviar la respuesta al cliente.",
    saves: "Entre 20 y 60 minutos por presupuesto, según su complejidad.",
    templates: ["presupuesto"],
  },
  {
    id: "informes",
    number: 6,
    title: "Informe semanal del negocio",
    tier: "negocio",
    problem: "Preparar informes a mano o no tener ninguno.",
    needs: ["ai", "hubspot", "google"],
    reads: "Ventas, clientes, agenda, CRM y tus planillas.",
    auto: "Reúne los datos, detecta cambios y pendientes, y redacta el informe.",
    approval: "Crear el documento o añadir la fila de cifras.",
    saves: "Una o dos horas de preparar el informe cada semana.",
    templates: ["informe-semanal", "volcado-semanal"],
  },
  {
    id: "recepcionista",
    number: 7,
    title: "Asistente de voz",
    tier: "avanzado",
    problem: "Llamadas perdidas y visitas de tu web que se van sin preguntar cuando estás ocupado o fuera del negocio.",
    needs: ["voice", "calendar", "google"],
    reads: "Tu agenda y los documentos que elijas (horarios, precios, preguntas frecuentes).",
    auto: "Atiende por voz en tu web y por teléfono: responde dudas, toma recados y reserva citas en tu horario.",
    approval: "Nada: las citas quedan confirmadas solo en huecos libres de tu horario de citas.",
    saves: "No perder clientes: cada conversación queda en la Bandeja y te avisa.",
    templates: [],
    link: { label: "Configurar el asistente de voz", path: "integraciones#asistente-voz" },
  },
  {
    id: "redes",
    number: 8,
    title: "Gestor de redes sociales",
    tier: "negocio",
    problem: "Redes sociales abandonadas por falta de tiempo.",
    needs: ["ai", "buffer"],
    reads: "Tus canales de Buffer y tus documentos de novedades.",
    auto: "Redacta las publicaciones de la semana adaptadas a cada red.",
    approval: "Cada publicación antes de programarse.",
    saves: "Unas 2 horas a la semana de pensar y redactar publicaciones.",
    templates: ["redes-sociales"],
  },
  {
    id: "facturas",
    number: 9,
    title: "Control de facturas y gastos",
    tier: "negocio",
    problem: "Facturas por apuntar, pagos que vencen y duplicados que se cuelan.",
    needs: ["ai", "google"],
    reads: "Tus facturas en Drive, tu registro en Sheets y, si la tienes, tu contabilidad en Xubio.",
    auto: "Extrae importes y fechas, detecta duplicados y vencimientos, y te avisa.",
    approval: "Añadir filas al registro.",
    saves: "Teclear cada factura a mano y los recargos por pagos olvidados.",
    templates: ["control-facturas", "control-vencimientos", "resumen-xubio"],
  },
  {
    id: "tareas",
    number: 10,
    title: "Coordinador de tareas",
    tier: "personal",
    problem: "Encargos y compromisos dispersos en mensajes que se olvidan.",
    needs: ["ai", "imap", "google"],
    reads: "Tus mensajes, reuniones y tu planilla de tareas.",
    auto: "Convierte peticiones en tareas con prioridad y fecha, y te recuerda las vencidas.",
    approval: "Añadir tareas a la planilla.",
    saves: "Olvidos y el tiempo de apuntar a mano lo que te piden.",
    templates: ["coordinador-tareas", "pedidos-a-planilla", "incidencias-telegram"],
  },
]

// ---------------------------------------------------------------------------
// Verticales: paquetes por sector. Cada una recomienda rutinas de las 10 y
// añade sus plantillas propias (que no están en ninguna rutina).
// ---------------------------------------------------------------------------
export type VerticalId = "inmobiliarias" | "clinicas" | "profesionales"

export type Vertical = {
  id: VerticalId
  title: string
  who: string
  pitch: string
  needs: TemplateNeed[]
  routines: string[]
  templates: string[]
  note?: string
}

export const VERTICALS: Vertical[] = [
  {
    id: "inmobiliarias",
    title: "Inmobiliarias",
    who: "Inmobiliarias y agentes",
    pitch: "Cada interesado recibe al momento las propiedades que encajan, las visitas tienen seguimiento y ninguna consulta se queda sin respuesta.",
    needs: ["imap", "tokko", "calendar", "contacts"],
    routines: ["bandeja", "agenda", "seguimiento", "recepcionista"],
    templates: ["consultas-propiedades", "seguimiento-visitas", "propiedades-nuevas"],
  },
  {
    id: "clinicas",
    title: "Clínicas",
    who: "Clínicas, consultas y centros de salud, fisioterapia o estética",
    pitch: "Citas sin idas y vueltas, recordatorios que reducen las ausencias y llamadas atendidas aunque estés en consulta.",
    needs: ["imap", "calendar", "contacts", "voice"],
    routines: ["agenda", "recepcionista", "bandeja", "secretaria"],
    templates: ["recordatorio-citas", "seguimiento-consulta"],
    note: "MarchaSolo gestiona la agenda y la comunicación, no la historia clínica: los mensajes no incluyen motivos de consulta ni datos de salud.",
  },
  {
    id: "profesionales",
    title: "Profesionales",
    who: "Abogados, arquitectos, ingenieros, asesores y despachos",
    pitch: "Presupuestos en minutos, plazos y vencimientos bajo control, reuniones preparadas y cada cliente nuevo dado de alta.",
    needs: ["imap", "google", "calendar", "contacts"],
    routines: ["presupuestos", "facturas", "tareas", "informes"],
    templates: ["alta-cliente"],
  },
]

// Compatibilidad: plantillas de sector, fuera de las 10 rutinas.
export const SECTOR_TEMPLATES: { title: string; templates: string[] }[] = VERTICALS.map((v) => ({ title: v.title, templates: v.templates }))

// Vertical de una automatización creada con una plantilla de sector.
export function verticalOfFlow(flow: { name: string; settings?: unknown }): Vertical | undefined {
  const id = templateIdOfFlow(flow)
  return id ? VERTICALS.find((v) => v.templates.includes(id)) : undefined
}

// Plantillas que se fusionaron con otra (31 oct 2026). Las automatizaciones ya
// creadas con ellas siguen funcionando; aquí solo se usan para agruparlas en
// su rutina.
const MERGED_TEMPLATES: Record<string, string> = {
  "resumen-manana": "secretaria-digital",
  "negocios-parados": "seguimiento-clientes",
  "informe-crm": "informe-semanal",
}

// Nombres de las plantillas fusionadas, para reconocer las automatizaciones
// creadas antes de que se guardara la plantilla de origen.
const MERGED_NAMES: Record<string, string> = {
  "Resumen de la mañana": "secretaria-digital",
  "Seguimiento de negocios parados": "seguimiento-clientes",
  "Informe semanal del CRM": "informe-semanal",
}

// Plantilla de origen de una automatización: la guardada al crearla
// (settings.template) o, si no la hay, la que tiene su mismo nombre.
export function templateIdOfFlow(flow: { name: string; settings?: unknown }): string | undefined {
  const settings = flow.settings && typeof flow.settings === "object" ? (flow.settings as Record<string, unknown>) : {}
  const saved = typeof settings.template === "string" ? settings.template : undefined
  if (saved) return MERGED_TEMPLATES[saved] ?? saved
  return MERGED_NAMES[flow.name] ?? TEMPLATES.find((t) => t.plan.name === flow.name)?.id
}

// Rutina a la que pertenece una automatización, si la hay.
export function routineOfFlow(flow: { name: string; settings?: unknown }): Routine | undefined {
  const id = templateIdOfFlow(flow)
  if (!id) return undefined
  return ROUTINES.find((r) => r.templates.includes(id))
}
