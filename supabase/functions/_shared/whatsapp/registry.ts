// Registro de proveedores: el único sitio del núcleo que importa adaptadores.
// Añadir un proveedor = un archivo en ./providers/ y una línea aquí.
import type { ConnectionContext, ProviderId, WhatsAppProvider } from "./contract.ts"
import { createTwilioProvider } from "./providers/twilio.ts"

const providers = new Map<ProviderId, WhatsAppProvider>([["twilio", createTwilioProvider()]])

export function getProvider(id: ProviderId): WhatsAppProvider {
  const p = providers.get(id)
  if (!p) throw new Error(`Proveedor de WhatsApp no registrado: ${id}`)
  return p
}

/** Solo para tests (proveedor falso). */
export function registerProvider(p: WhatsAppProvider): void {
  providers.set(p.id, p)
}

/**
 * Secreto de Vault (JSON) → contexto de conexión. El campo "provider" del
 * secreto dice qué adaptador lo entiende. null si no es válido.
 */
export function contextFromSecret(raw: string | null | undefined, ids: { integrationId: string; workspaceId: string }): ConnectionContext | null {
  let s: Record<string, unknown>
  try {
    s = JSON.parse(raw ?? "") as Record<string, unknown>
  } catch {
    return null
  }
  if (!s || typeof s !== "object" || typeof s.provider !== "string") return null
  const p = providers.get(s.provider as ProviderId)
  const parsed = p?.parseSecret(s)
  if (!p || !parsed) return null
  return { ...ids, provider: p.id, ...parsed }
}
