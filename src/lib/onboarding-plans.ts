import type { FlowPlan, PlanStep } from "@/lib/plan"

// Planes del onboarding cuando no hay IA (ni propia ni de prueba) o el
// asistente falla. Se elige la plantilla con más palabras clave en la tarea;
// si ninguna encaja, un plan genérico honesto. Las sugerencias del paso 1
// están escritas para caer cada una en su plantilla.

type Template = { keywords: string[]; plan: Omit<FlowPlan, "version"> }

const step = (
  id: string,
  kind: string,
  title: string,
  description: string,
  connection: string,
  requires_approval = false,
): PlanStep => ({ id, kind, title, description, connection, requires_approval })

const manual = { type: "manual" as const, description: "Cuando lo pidas" }

const TEMPLATES: Template[] = [
  {
    keywords: ["propiedad", "inmueble", "piso", "alquiler", "visita", "interesad", "inmobiliari", "tokko"],
    plan: {
      name: "Responder a los interesados en una propiedad",
      summary: "Detecta las consultas sobre propiedades, busca la ficha y te deja preparada la respuesta con los datos y una propuesta de visita.",
      trigger: { type: "email_message", description: "Cuando llega una consulta por correo" },
      connections: [{ kind: "email", purpose: "Leer las consultas y responderlas" }],
      steps: [
        step("s1", "read", "Leer la consulta", "Quién pregunta y por qué propiedad.", "email"),
        step("s2", "read", "Buscar la ficha de la propiedad", "Precio, superficie, disponibilidad y fotos.", "properties"),
        step("s3", "generate", "Preparar la respuesta", "Con los datos de la ficha y huecos para la visita. Sale solo si la apruebas.", "email", true),
      ],
      open_questions: ["¿Ofrecemos siempre visita o solo cuando la propiedad está disponible?"],
    },
  },
  {
    keywords: ["cita", "turno", "reserva", "paciente", "recordar", "recordatorio", "agenda", "calendario", "reunion", "evento", "mañana"],
    plan: {
      name: "Recordar sus citas a tus clientes",
      summary: "Cada tarde mira las citas del día siguiente y prepara un recordatorio para cada cliente.",
      trigger: { type: "schedule", description: "Cada día laborable a las 18:00" },
      connections: [
        { kind: "calendar", purpose: "Ver las citas de mañana" },
        { kind: "email", purpose: "Enviar los recordatorios" },
      ],
      steps: [
        step("s1", "read", "Ver las citas de mañana", "Hora, cliente y motivo de cada cita.", "calendar"),
        step("s2", "generate", "Preparar los recordatorios", "Un mensaje corto para cada cliente, con la hora y cómo cambiarla. Salen solo si los apruebas.", "email", true),
      ],
      open_questions: ["¿Lo enviamos por correo o por WhatsApp?"],
    },
  },
  {
    keywords: ["factura", "cobro", "cobrar", "pago", "pendiente", "deuda", "vencimiento", "vence", "moroso"],
    plan: {
      name: "Avisar de los pagos pendientes",
      summary: "Revisa tu planilla de cobros, detecta lo vencido y prepara un aviso amable para cada cliente.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [
        { kind: "spreadsheet", purpose: "Leer la planilla de cobros" },
        { kind: "email", purpose: "Enviar los avisos" },
      ],
      steps: [
        step("s1", "read", "Revisar la planilla de cobros", "Qué está vencido o vence esta semana.", "spreadsheet"),
        step("s2", "generate", "Preparar los avisos", "Un recordatorio amable por cliente, con el importe y la fecha. Salen solo si los apruebas.", "email", true),
        step("s3", "notify", "Avisarte del total pendiente", "Un resumen para ti con lo que falta por cobrar.", "none"),
      ],
      open_questions: ["¿Qué columnas de la planilla tienen el cliente, el importe y la fecha?"],
    },
  },
  {
    keywords: ["planilla", "hoja", "excel", "sheets", "pedido", "registrar", "apuntar", "stock", "inventario", "datos"],
    plan: {
      name: "Pasar los pedidos a tu planilla",
      summary: "Saca los datos de cada pedido que llega por correo y te propone la fila para tu planilla.",
      trigger: { type: "email_message", description: "Cuando llega un pedido por correo" },
      connections: [
        { kind: "email", purpose: "Leer los pedidos" },
        { kind: "spreadsheet", purpose: "Añadir una fila por pedido" },
      ],
      steps: [
        step("s1", "read", "Leer el pedido", "Cliente, productos, cantidades e importe.", "email"),
        step("s2", "write", "Añadir la fila a la planilla", "Ves la fila exacta antes de que se escriba.", "spreadsheet", true),
      ],
      open_questions: ["¿En qué planilla y con qué columnas?"],
    },
  },
  {
    keywords: ["resumen", "informe", "reporte", "semanal", "semana", "ventas", "cifras", "viernes", "lunes"],
    plan: {
      name: "Tu informe de la semana",
      summary: "Cada viernes reúne las cifras de tu planilla y lo importante de tus correos y te manda un resumen claro.",
      trigger: { type: "schedule", description: "Cada viernes a las 17:00" },
      connections: [
        { kind: "spreadsheet", purpose: "Leer las cifras" },
        { kind: "email", purpose: "Ver lo importante de la semana" },
      ],
      steps: [
        step("s1", "read", "Reunir las cifras de la semana", "Ventas, pedidos o lo que lleves en tu planilla.", "spreadsheet"),
        step("s2", "read", "Repasar los correos importantes", "Clientes nuevos, consultas abiertas y temas pendientes.", "email"),
        step("s3", "notify", "Enviarte el informe", "Un resumen corto con lo que ha ido bien y lo que hay que mirar.", "none"),
      ],
      open_questions: ["¿Qué cifras quieres ver cada semana?"],
    },
  },
  {
    keywords: ["redes", "instagram", "facebook", "linkedin", "publicacion", "publicar", "post", "contenido"],
    plan: {
      name: "Publicaciones para tus redes",
      summary: "Prepara las publicaciones de la semana con el tono de tu negocio y las deja listas para programar.",
      trigger: { type: "schedule", description: "Cada lunes a las 9:00" },
      connections: [{ kind: "social", purpose: "Programar las publicaciones" }],
      steps: [
        step("s1", "generate", "Redactar las publicaciones", "Tres ideas para la semana, con texto y sugerencia de imagen.", "none"),
        step("s2", "write", "Programarlas", "Se programan solo las que apruebes.", "social", true),
      ],
      open_questions: ["¿Sobre qué temas quieres publicar?"],
    },
  },
  {
    keywords: ["correo", "email", "mail", "bandeja", "responder", "respuesta", "contestar", "consulta", "mensaje", "presupuesto", "cliente"],
    plan: {
      name: "Responder las consultas de tus clientes",
      summary: "Ordena tus correos por urgencia y te deja preparada la respuesta a los que la necesitan.",
      trigger: { type: "email_message", description: "Cuando llega un correo" },
      connections: [{ kind: "email", purpose: "Leer la bandeja y responder" }],
      steps: [
        step("s1", "read", "Leer los correos nuevos", "Quién escribe y qué necesita.", "email"),
        step("s2", "transform", "Ordenarlos por urgencia", "Clientes, presupuestos, facturas y avisos, cada uno en su sitio.", "none"),
        step("s3", "generate", "Preparar las respuestas", "Solo para los que la necesitan. Salen solo si las apruebas.", "email", true),
      ],
      open_questions: ["¿Hay consultas que se respondan siempre igual?"],
    },
  },
]

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

export function localPlan(text: string, businessIntake?: { businessType?: string; mainPain?: string; channels?: string[] }): FlowPlan {
  const t = normalize(text)
  const businessLabels: Record<string, string> = {
    professional: "servicios profesionales o consultoría", agency: "agencia o estudio", retail: "comercio o tienda",
    real_estate: "inmobiliaria", health: "salud o clínica", hospitality: "hostelería o turismo",
    industry: "industria o fabricación", other: "otro tipo de negocio",
  }
  const priorityLabels: Record<string, string> = {
    customer_messages: "responder consultas y mensajes", appointments: "organizar citas y reservas",
    sales_followup: "hacer seguimiento de clientes y ventas", admin: "reducir tareas administrativas",
    billing: "gestionar facturas y cobros", reporting: "preparar informes y controlar el negocio",
    marketing: "crear contenido y gestionar redes sociales", other: "otra tarea indicada por el usuario",
  }
  const channelLabels: Record<string, string> = {
    email: "correo", whatsapp: "WhatsApp", instagram: "Instagram o redes sociales",
    website: "web o formularios", phone: "teléfono", in_person: "atención presencial",
  }
  const businessType = businessIntake?.businessType && businessLabels[businessIntake.businessType]
    ? businessLabels[businessIntake.businessType] : ""
  const mainPain = businessIntake?.mainPain && priorityLabels[businessIntake.mainPain]
    ? priorityLabels[businessIntake.mainPain] : ""
  const channels = [...new Set((businessIntake?.channels ?? []).filter((channel) => typeof channel === "string" && channel in channelLabels))]
    .slice(0, 6).map((channel) => channelLabels[channel])
  const contextParts = [businessType ? `Tipo de negocio: ${businessType}` : "", mainPain ? `Prioridad: ${mainPain}` : "", channels.length ? `Canales indicados: ${channels.join(", ")}` : ""]
    .filter(Boolean)
  const contextLine = contextParts.length ? ` Contexto aportado: ${contextParts.join(" · ")}.` : ""
  let best: Template | null = null
  let bestScore = 0
  for (const tpl of TEMPLATES) {
    const score = tpl.keywords.filter((k) => t.includes(normalize(k))).length
    if (score > bestScore) {
      best = tpl
      bestScore = score
    }
  }
  if (best) return { version: 1, ...best.plan, summary: `${best.plan.summary}${contextLine}` }

  return {
    version: 1,
    name: "Tu tarea, a medida",
    summary: `${text.trim().slice(0, 200)}${contextLine}`,
    trigger: manual,
    connections: [],
    steps: [
      step("s1", "read", "Reunir lo que hace falta", "Los datos y documentos que uses hoy para esta tarea.", "none"),
      step("s2", "generate", "Preparar el resultado", "Lo que hoy haces a mano: el mensaje, la fila, el resumen…", "none"),
      step("s3", "notify", "Enseñártelo para que lo revises", "Nada se envía ni se cambia sin tu aprobación.", "none", true),
    ],
    open_questions: ["¿Qué herramientas usas hoy para esta tarea?"],
  }
}
