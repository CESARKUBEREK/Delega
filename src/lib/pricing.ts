// Condiciones comerciales que se muestran en /precios (decisiones de Cesar,
// 11 nov; ver claude/spec-precios-ia-incluida.md). La IA de MarchaSolo va
// incluida con un cupo de tareas al mes; con la IA propia no hay límite de tareas.
// Precios en dólares estadounidenses (USD). Deben coincidir con plan_prices
// (migración 20261111220000_plan_catalog_v2): lo comprueba tests/pricing.test.mjs.

export type Plan = {
  id: string
  name: string
  price: string
  period: string
  priceYear?: string
  monthlyTasks: number
  tagline: string
  includes: string[]
  cta: string
  recommended?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    price: "19 USD",
    period: "/mes",
    priceYear: "190 USD/año (2 meses gratis)",
    monthlyTasks: 200,
    tagline: "Para quien trabaja solo y quiere quitarse tareas de encima.",
    includes: [
      "200 tareas al mes con IA incluida",
      "5 automatizaciones activas",
      "Bandeja ordenada y respuestas preparadas",
      "Correo, Telegram, agenda, Drive y CRM",
      "Tú apruebas antes de que salga nada",
      "Sin límite de tareas con tu propia IA",
    ],
    cta: "Empezar con Solo",
  },
  {
    id: "pro",
    name: "Negocio",
    price: "49 USD",
    period: "/mes",
    priceYear: "490 USD/año (2 meses gratis)",
    monthlyTasks: 600,
    tagline: "Para atender a tus clientes por WhatsApp y coordinar varias aplicaciones.",
    includes: [
      "600 tareas al mes con IA incluida",
      "20 automatizaciones activas",
      "WhatsApp con tu número",
      "Asistente de voz en tu web",
      "2 usuarios",
      "Todo lo de Solo",
    ],
    cta: "Empezar con Negocio",
    recommended: true,
  },
  {
    id: "business",
    name: "Equipo",
    price: "99 USD",
    period: "/mes",
    priceYear: "990 USD/año (2 meses gratis)",
    monthlyTasks: 1500,
    tagline: "Para inmobiliarias y despachos con varias personas.",
    includes: [
      "1.500 tareas al mes con IA incluida",
      "50 automatizaciones activas",
      "5 usuarios (12 USD por usuario extra)",
      "Procesos compartidos y supervisión del equipo",
      "Todo lo de Negocio",
    ],
    cta: "Empezar con Equipo",
  },
]

// Prueba gratuita: propuestas preparadas y ejecuciones reales con la IA de
// MarchaSolo durante 14 días o hasta 1 USD de IA, lo que llegue antes.
export const TRIAL = { plans: 2, usd: 1, days: 14 }
