// Cliente mínimo de la API de Buffer (GraphQL, https://api.buffer.com). La
// clave de API del usuario (Buffer → Settings → API) vive en Vault y nunca se
// registra.
//
// - Lectura: organizaciones y canales (redes sociales conectadas en Buffer).
// - Escritura (siempre con aprobación): crear una publicación en la cola de un
//   canal o programada para una fecha y hora.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const API = "https://api.buffer.com"

export const BUFFER_KEY_RE = /^[A-Za-z0-9._-]{20,400}$/
export const MAX_POST_CHARS = 5000

export class BufferError extends Error {
  constructor(public code: "invalid_key" | "rate_limited" | "bad_request" | "unavailable", message: string) {
    super(message)
  }
}

export type BufferChannel = { id: string; name: string; service: string; organization: string; paused: boolean }

// Cadena GraphQL segura: el formato de JSON.stringify es válido en GraphQL.
const q = (v: string) => JSON.stringify(v)

async function gql<T>(key: string, query: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new BufferError("unavailable", "Buffer no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message?: string; extensions?: { code?: string } }[] }
  const first = data.errors?.[0]
  if (res.status === 401 || first?.extensions?.code === "UNAUTHENTICATED") throw new BufferError("invalid_key", "Buffer no reconoce la clave de API.")
  if (res.status === 429 || first?.extensions?.code === "RATE_LIMIT_EXCEEDED") {
    throw new BufferError("rate_limited", "Buffer pide esperar un poco (límite de peticiones de tu plan).")
  }
  if (!res.ok || !data.data) {
    throw new BufferError(res.status >= 500 ? "unavailable" : "bad_request", `Buffer rechazó la petición${first?.message ? `: ${String(first.message).slice(0, 240)}` : ""}.`)
  }
  return data.data
}

export async function organizations(key: string): Promise<{ id: string; name: string }[]> {
  const d = await gql<{ account?: { organizations?: { id: string; name: string }[] } }>(key, "query { account { organizations { id name } } }")
  return d.account?.organizations ?? []
}

// Canales de todas las organizaciones de la cuenta.
export async function listChannels(key: string): Promise<BufferChannel[]> {
  const orgs = await organizations(key)
  const out: BufferChannel[] = []
  for (const org of orgs.slice(0, 10)) {
    const d = await gql<{ channels?: { id: string; name?: string; displayName?: string; service?: string; isQueuePaused?: boolean }[] }>(
      key,
      `query { channels(input: { organizationId: ${q(org.id)} }) { id name displayName service isQueuePaused } }`,
    )
    for (const c of d.channels ?? []) {
      out.push({ id: c.id, name: c.displayName || c.name || c.id, service: c.service ?? "", organization: org.name, paused: c.isQueuePaused === true })
    }
  }
  return out
}

// Comprueba la clave y cuenta los canales.
export async function checkKey(key: string): Promise<{ organizations: number; channels: number }> {
  const orgs = await organizations(key)
  const channels = orgs.length ? (await listChannels(key)).length : 0
  return { organizations: orgs.length, channels }
}

// Crea una publicación: a la cola del canal (dueAt null) o programada (dueAt en UTC).
export async function createPost(key: string, input: { channelId: string; text: string; dueAt: string | null }): Promise<{ id: string }> {
  const mode = input.dueAt ? `mode: customScheduled, dueAt: ${q(input.dueAt)}` : "mode: addToQueue"
  const d = await gql<{ createPost?: { post?: { id: string }; message?: string } }>(
    key,
    `mutation { createPost(input: { text: ${q(input.text)}, channelId: ${q(input.channelId)}, schedulingType: automatic, ${mode} }) {
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    } }`,
  )
  if (!d.createPost?.post) throw new BufferError("bad_request", `Buffer no creó la publicación${d.createPost?.message ? `: ${d.createPost.message}` : ""}.`)
  return { id: d.createPost.post.id }
}

export async function bufferKey(admin: SupabaseClient, workspaceId: string): Promise<string | null> {
  const [{ data }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "buffer" }),
    admin.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "buffer").maybeSingle(),
  ])
  const secret = (data?.[0] as { refresh_token?: string } | undefined)?.refresh_token
  return secret && integ?.status === "active" ? secret : null
}
