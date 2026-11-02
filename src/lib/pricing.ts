// Condiciones comerciales que se muestran en /precios.
// La IA se paga aparte al proveedor (BYOK). Los límites de automatizaciones
// son los del plan; el control (aprobación antes de enviar/cambiar) va en todos.

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
    price: "19 €",
    period: "/mes",
    priceYear: "228 €/año · IVA no incluido",
    tagline: "Para autónomos que quieren automatizar tareas cotidianas.",
    includes: [
      "Asistente de IA",
      "5 automatizaciones activas",
      "Integraciones básicas",
      "1 modelo de IA conectado",
      "Historial de ejecuciones",
      "Nada se envía sin tu aprobación",
    ],
    cta: "Empezar con Solo",
    recommended: true,
  },
  {
    id: "pro",
    name: "MarchaSolo Pro",
    price: "39 €",
    period: "/mes",
    priceYear: "468 €/año · IVA no incluido",
    tagline: "Para profesionales y pequeños negocios que quieren delegar más trabajo.",
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
    price: "79 €",
    period: "/mes",
    priceYear: "948 €/año · IVA no incluido",
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

// Créditos de IA de prueba (por espacio personal): chat y onboarding.
export const TRIAL = { tokens: 50_000, scope: "el asistente del chat y el onboarding" }
