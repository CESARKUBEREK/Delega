import type { FlowPlan, PlanStep } from "@/lib/plan"

// Plantillas de automatización: planes listos para usar con las integraciones
// que ya funcionan. Al elegir una se crea un borrador en el espacio; la persona
// elige después los archivos, los filtros y la activa. Todo lo que escribe o
// envía espera aprobación, como cualquier otro flujo.

export type TemplateNeed = "ai" | "imap" | "telegram" | "google" | "calendar" | "hubspot" | "tokko" | "xubio"

export type FlowTemplate = {
  id: string
  category: "Correo" | "Telegram" | "CRM" | "Agenda" | "Informes" | "Avisos" | "Inmobiliaria" | "Contabilidad"
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
  google: "Google Drive",
  calendar: "Google Calendar",
  hubspot: "HubSpot",
  tokko: "Tokko Broker",
  xubio: "Xubio",
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
    id: "resumen-manana",
    category: "Avisos",
    needs: ["ai", "imap", "calendar"],
    settings: { schedule: { frequency: "weekdays", time: "08:00", weekday: 1, day_of_month: 1 } },
    setup: "Te llega cada día laborable a las 8:00, al móvil y a tu correo, sin aprobación. Cambia la hora si quieres.",
    plan: {
      version: 1,
      name: "Resumen de la mañana",
      summary: "Cada mañana te avisa de lo importante: correos y mensajes de las últimas 24 horas, la agenda del día y lo que espera tu aprobación.",
      trigger: { type: "schedule", description: "Días laborables a las 8:00" },
      connections: [
        { kind: "email", purpose: "Leer la bandeja de las últimas 24 horas" },
        { kind: "calendar", purpose: "Ver la agenda de hoy" },
      ],
      steps: steps([
        { kind: "read", title: "Revisar la bandeja", description: "Conversaciones con actividad en las últimas 24 horas, primero las urgentes y las que esperan respuesta.", connection: "email", requires_approval: false },
        { kind: "read", title: "Mirar la agenda", description: "Eventos de hoy, con hora y asistentes.", connection: "calendar", requires_approval: false },
        { kind: "generate", title: "Preparar el resumen", description: "Lo urgente arriba; después la agenda y el resto, en pocas líneas.", connection: "none", requires_approval: false },
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
        { kind: "read", title: "Reuniones de mañana", description: "Eventos del día siguiente con asistentes.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Fichas del CRM", description: "Para cada asistente externo: contacto, empresa, negocios abiertos y última nota.", connection: "crm", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Para cada reunión: hora, con quién, en qué punto está y qué preparar. Si no hay reuniones, no avisar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "informe-crm",
    category: "CRM",
    needs: ["ai", "hubspot"],
    settings: { schedule: { frequency: "weekly", time: "08:30", weekday: 1, day_of_month: 1 } },
    setup: "Cada lunes a las 8:30 te avisa con el estado del CRM.",
    plan: {
      version: 1,
      name: "Informe semanal del CRM",
      summary: "Cada lunes te resume el CRM: negocios nuevos, los que cambiaron de etapa, los que llevan tiempo parados y las tareas vencidas.",
      trigger: { type: "schedule", description: "Cada lunes a las 8:30" },
      connections: [{ kind: "crm", purpose: "Leer negocios y tareas" }],
      steps: steps([
        { kind: "read", title: "Etapas", description: "Pipelines y etapas de los negocios.", connection: "crm", requires_approval: false },
        { kind: "read", title: "Negocios", description: "Negocios abiertos con su etapa, importe y fecha de última modificación.", connection: "crm", requires_approval: false },
        { kind: "generate", title: "Resumir", description: "Nuevos de la semana, cambios de etapa, parados más de 14 días e importe total abierto.", connection: "none", requires_approval: false },
        { kind: "notify", title: "Avisarte", description: "Enviarte el informe.", connection: "none", requires_approval: false },
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
    setup: "Revisa las palabras que la lanzan. Para crear el evento con invitados, el cliente tiene que estar en tus contactos autorizados.",
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
        { kind: "write", title: "Reservar si ya hay fecha", description: "Si el correo ya fija una fecha que está libre, proponer crear el evento.", connection: "calendar", requires_approval: true },
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
    id: "negocios-parados",
    category: "CRM",
    needs: ["ai", "hubspot", "imap"],
    settings: { schedule: { frequency: "weekly", time: "09:00", weekday: 1, day_of_month: 1 } },
    setup: "Se ejecuta los lunes a las 9:00 (puedes cambiarlo) y te avisa con la lista. Solo puede escribir a tus contactos autorizados.",
    plan: {
      version: 1,
      name: "Seguimiento de negocios parados",
      summary: "Busca los negocios abiertos de HubSpot sin actividad reciente y prepara un correo de seguimiento y una tarea para cada uno.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [
        { kind: "crm", purpose: "Buscar negocios sin actividad y crear tareas" },
        { kind: "email", purpose: "Enviar el seguimiento" },
      ],
      steps: steps([
        { kind: "read", title: "Buscar negocios abiertos", description: "Negocios que no están ganados ni perdidos, con su fecha de última modificación.", connection: "crm", requires_approval: false },
        { kind: "condition", title: "Quedarse con los parados", description: "Los que llevan más de 14 días sin cambios (máximo 5).", connection: "none", requires_approval: false },
        { kind: "notify", title: "Correo de seguimiento", description: "Un correo breve y cordial a su contacto, si es un contacto autorizado.", connection: "email", requires_approval: true },
        { kind: "write", title: "Tarea en el CRM", description: "Tarea de seguimiento para dentro de 3 días.", connection: "crm", requires_approval: true },
        { kind: "notify", title: "Avisarte", description: "Avisarte con la lista de negocios parados y lo que queda por aprobar.", connection: "none", requires_approval: false },
      ]),
      open_questions: [],
    },
  },
  {
    id: "informe-semanal",
    category: "Informes",
    needs: ["ai", "calendar", "hubspot", "google"],
    settings: { schedule: { frequency: "weekly", time: "17:00", weekday: 5, day_of_month: 1 } },
    setup: "Se ejecuta los viernes a las 17:00 (puedes cambiarlo). Crear el documento espera tu aprobación.",
    plan: {
      version: 1,
      name: "Informe de la semana",
      summary: "Resume la semana en un documento: reuniones hechas, negocios que avanzaron y tareas pendientes en el CRM.",
      trigger: { type: "schedule", description: "Cada viernes a las 17:00" },
      connections: [
        { kind: "calendar", purpose: "Reuniones de la semana" },
        { kind: "crm", purpose: "Negocios y tareas" },
        { kind: "documents", purpose: "Crear el informe" },
      ],
      steps: steps([
        { kind: "read", title: "Reuniones", description: "Eventos de lunes a viernes de esta semana.", connection: "calendar", requires_approval: false },
        { kind: "read", title: "Negocios y tareas", description: "Negocios abiertos con su etapa y tareas pendientes.", connection: "crm", requires_approval: false },
        { kind: "generate", title: "Redactar el informe", description: "Resumen breve: lo hecho, lo que avanzó y lo pendiente para la semana que viene.", connection: "none", requires_approval: false },
        { kind: "write", title: "Crear el documento", description: "Crear «Informe semanal – fecha».", connection: "documents", requires_approval: true },
      ]),
      open_questions: [],
    },
  },
]

export function findTemplate(id: string): FlowTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
