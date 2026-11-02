// Condiciones comerciales que se muestran en /precios. Solo lo que existe hoy.
// Cuando haya planes de pago, se añaden aquí (PLANS) y la página los muestra.

export type Plan = { id: string; name: string; price: string; period: string; includes: string[]; cta: string }

// Sin planes de pago por ahora (2 nov 2026): crear la cuenta y usar MarchaSolo no tiene coste.
export const PLANS: Plan[] = []

// Créditos de IA de prueba de MarchaSolo (decisión del 1 nov): por espacio
// personal, solo para el chat y el onboarding. Ver supabase/migrations/*_trial_credits.sql.
export const TRIAL = { tokens: 50_000, scope: "el asistente del chat y el onboarding" }
