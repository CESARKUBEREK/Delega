// Solo valores públicos: la URL del proyecto y la clave publicable.
// Nunca se lee aquí una clave secreta ni la service_role.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local.",
  )
}

if (publishableKey.startsWith("sb_secret_")) {
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contiene una clave secreta. Usa la clave publicable.")
}

export const supabaseUrl = url
export const supabasePublishableKey = publishableKey
