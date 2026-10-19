import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { supabasePublishableKey, supabaseUrl } from "./env"

// Cliente para componentes de navegador. La sesión viaja en cookies que
// gestiona @supabase/ssr; los permisos los decide la RLS en la base de datos.
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)
}
