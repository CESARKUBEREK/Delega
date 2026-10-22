// Utilidades comunes de las Edge Functions de Delega.
// - Autentica al usuario con su JWT (getClaims) y crea dos clientes:
//   userClient (respeta RLS) y admin (service role, solo tras autorizar).
// - Nunca registra en logs claves, tokens ni el contenido de los mensajes.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

export type Role = "owner" | "admin" | "member"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}

export function fail(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status)
}

function keyFromEnv(jsonVar: string, legacyVar: string): string {
  const raw = Deno.env.get(jsonVar)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // continúa con la variable heredada
    }
  }
  const legacy = Deno.env.get(legacyVar)
  if (!legacy) throw new Error(`Falta ${jsonVar}/${legacyVar}`)
  return legacy
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

export type AuthContext = {
  userId: string
  userClient: SupabaseClient
  admin: SupabaseClient
}

export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const header = req.headers.get("Authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token) return fail(401, "unauthenticated", "Se requiere sesión.")

  const userClient = createClient(SUPABASE_URL, keyFromEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getClaims(token)
  const sub = data?.claims?.sub
  if (error || typeof sub !== "string") return fail(401, "unauthenticated", "La sesión no es válida.")

  const admin = createClient(SUPABASE_URL, keyFromEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { userId: sub, userClient, admin }
}

// Rol activo del usuario en el espacio, leído con SU cliente (RLS).
export async function membershipRole(ctx: AuthContext, workspaceId: string): Promise<Role | null> {
  const { data } = await ctx.userClient
    .from("memberships")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", ctx.userId)
    .maybeSingle()
  if (!data || data.status !== "active") return null
  return data.role as Role
}
