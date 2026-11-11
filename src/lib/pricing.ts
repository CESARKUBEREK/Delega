// Condiciones comerciales que se muestran en /precios.
// La IA se paga aparte al proveedor (BYOK). Los límites de automatizaciones
// son del plan; las funciones de revisión y aprobación de acciones están incluidas en todos.
// Precios en dólares estadounidenses (USD).

export type Plan = {
  id: string
  name: string
  price: string
  period: string
  priceYear?: string
  tagline: string
  includes: string[]
  cta: string
  recommended?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "MarchaSolo Solo",
    price: "19 $",
    period: "/mes",
    priceYear: "228 $/año · USD",
    tagline: "Para profesionales independientes que buscan automatizar tareas cotidianas.",
    includes: [
      "Asistente de IA",
      "5 automatizaciones activas",
      "Integraciones básicas",
      "1 modelo de IA conectado",
      "Historial de ejecuciones",
      "Revisión de acciones sujetas a aprobación",
    ],
    cta: "Empezar con Solo",
    recommended: true,
  },
  {
    id: "pro",
    name: "MarchaSolo Pro",
    price: "39 $",
    period: "/mes",
    priceYear: "468 $/año · USD",
    tagline: "Para profesionales y pequeños negocios que buscan delegar más tareas.",
    includes: [
      "20 automatizaciones activas",
      "Flujos con múltiples pasos y agentes",
      "Varias aplicaciones conectadas",
      "Selección de diferentes modelos de IA",
      "Mayor capacidad de ejecución",
      "Nada se envía sin tu aprobación",
    ],
    cta: "Empezar con Pro",
  },
  {
    id: "business",
    name: "MarchaSolo Business",
    price: "79 $",
    period: "/mes",
    priceYear: "948 $/año · USD",
    tagline: "Para microempresas y equipos pequeños.",
    includes: [
      "50 automatizaciones activas",
      "Varios usuarios",
      "Procesos compartidos",
      "Mayor volumen de ejecuciones",
      "Gestión y supervisión del equipo",
      "Nada se envía sin tu aprobación",
    ],
    cta: "Empezar con Business",
  },
]

// Planes de prueba del onboarding (por espacio personal).
/** Prueba gratuita: propuestas preparadas y ejecuciones reales con la IA de MarchaSolo. */
export const TRIAL = { plans: 2, usd: 1 }
