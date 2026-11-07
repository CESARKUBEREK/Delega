// Adónde lleva «Pasar al plan Solo» cuando termina la prueba gratuita.
// Todavía no hay cobro integrado: si NEXT_PUBLIC_SOLO_CHECKOUT_URL tiene un
// enlace de pago (p. ej. un Payment Link de Stripe), se usa; si no, la tarjeta
// del plan Solo en /precios.
import { PLANS } from "@/lib/pricing"

export const SOLO_PLAN = PLANS.find((p) => p.id === "solo")!

export const SOLO_UPGRADE_URL = process.env.NEXT_PUBLIC_SOLO_CHECKOUT_URL?.trim() || "/precios#solo"

export const SOLO_UPGRADE_IS_EXTERNAL = /^https?:\/\//.test(SOLO_UPGRADE_URL)
