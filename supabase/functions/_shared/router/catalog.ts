// Catálogo de modelos (tabla llm_models), con caché por instancia de la
// función. Si la tabla no responde, la copia de reserva de core.ts.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { FALLBACK_CATALOG, type ModelInfo, toModelInfo } from "./core.ts"

const TTL_MS = 5 * 60_000
let cache: { at: number; models: ModelInfo[] } | null = null

export async function loadCatalog(admin: SupabaseClient): Promise<ModelInfo[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.models
  const { data, error } = await admin.from("llm_models").select("*")
  const models = !error && data?.length
    ? (data as Record<string, unknown>[]).map(toModelInfo).filter((x): x is ModelInfo => x !== null)
    : FALLBACK_CATALOG
  cache = { at: Date.now(), models: models.length ? models : FALLBACK_CATALOG }
  return cache.models
}

export async function modelInfo(admin: SupabaseClient, model: string): Promise<ModelInfo | undefined> {
  return (await loadCatalog(admin)).find((x) => x.model === model)
}
