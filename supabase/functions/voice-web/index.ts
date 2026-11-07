// voice-web: asistente de voz en la web del cliente (Grok Voice desde el
// navegador). Pública, sin JWT de Supabase: la llama la página /hablar/<id>
// de MarchaSolo, que el cliente inserta en su web.
//
//   start  Comprueba que el asistente está activo y los límites (conversaciones
//          al día y por visitante), y devuelve un token temporal de xAI (5 min,
//          solo para conectarse), la configuración de la sesión (instrucciones
//          y herramientas) y una credencial de sesión para pedir herramientas.
//   tool   Ejecuta una herramienta (horarios libres, reservar cita, mensaje, documentos)
//          para una sesión válida: las mismas reglas que el teléfono.
//   end    Marca la conversación como terminada.
//
// La clave de xAI del espacio nunca sale de aquí. Lo que diga el visitante es
// información, nunca instrucciones.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { isUuid, workspaceTimezone } from "../_shared/core.ts"
import { randomToken, sha256Hex } from "../_shared/google.ts"
import { callVoiceTool, readVoiceConfig, sameToken, VOICE_PROVIDER, VoiceError, voiceTools, webInstructions, webTools } from "../_shared/voice.ts"

function serviceKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // variable heredada
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })

const WIDGET_RE = /^msw_[A-Za-z0-9_-]{20,60}$/
const SESSIONS_PER_VISITOR_HOUR = 3
const MAX_TOOL_CALLS = 40
const MODEL = "grok-voice-latest"
const VOICE = "eve"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Max-Age": "86400",
}
const send = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } })
const fail = (status: number, code: string, message: string) => send({ error: { code, message } }, status)

function hostOf(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return fail(400, "bad_request", "Petición no válida.")

  if (body.action === "start") {
    const publicId = typeof body.widget === "string" && WIDGET_RE.test(body.widget) ? body.widget : null
    if (!publicId) return fail(404, "not_found", "Este asistente no existe.")
    const { data: widget } = await admin.from("voice_web_widgets").select("*").eq("public_id", publicId).maybeSingle()
    if (!widget || !widget.enabled) return fail(404, "disabled", "El asistente de voz no está disponible ahora.")
    const workspaceId = widget.workspace_id as string

    // Web donde está insertado (orientativo: el navegador lo informa).
    const parent = hostOf(body.parent)
    const allowed = (widget.allowed_domains as string[]) ?? []
    if (allowed.length && parent && !allowed.some((d) => parent === d || parent.endsWith(`.${d}`))) {
      return fail(403, "domain", "Este asistente no está autorizado en esta web.")
    }

    const { data: integ } = await admin.from("integrations").select("id, status, config").eq("workspace_id", workspaceId).eq("provider", VOICE_PROVIDER).maybeSingle()
    if (!integ || integ.status !== "active") return fail(409, "no_voice", "El asistente de voz no está configurado.")
    const config = readVoiceConfig(integ.config)

    // Límites: conversaciones en 24 h y por visitante en la última hora.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocido"
    const visitor = await sha256Hex(`${workspaceId}:${ip}`)
    const [{ count: today }, { count: recent }] = await Promise.all([
      admin.from("voice_web_sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("started_at", new Date(Date.now() - 86_400_000).toISOString()),
      admin.from("voice_web_sessions").select("id", { count: "exact", head: true }).eq("visitor_hash", visitor).gte("started_at", new Date(Date.now() - 3_600_000).toISOString()),
    ])
    if ((today ?? 0) >= (widget.sessions_per_day as number)) return fail(429, "daily_limit", "Ahora no podemos atenderte por voz. Inténtalo más tarde o escríbenos.")
    if ((recent ?? 0) >= SESSIONS_PER_VISITOR_HOUR) return fail(429, "visitor_limit", "Has iniciado varias conversaciones seguidas. Inténtalo dentro de un rato.")

    // Token temporal de xAI con la clave del espacio.
    const { data: keyRows } = await admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: "xai" })
    const key = keyRows?.[0] as { api_key: string; status: string } | undefined
    if (!key || key.status !== "active") return fail(409, "no_xai", "El asistente de voz no está configurado.")
    let ephemeral: string | null = null
    try {
      const r = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
        method: "POST",
        headers: { Authorization: `Bearer ${key.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expires_after: { seconds: 300 } }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = (await r.json().catch(() => ({}))) as { value?: string; client_secret?: { value?: string }; token?: string }
      if (r.ok) ephemeral = data.value ?? data.client_secret?.value ?? data.token ?? null
      else console.error("voice-web token", r.status)
    } catch {
      ephemeral = null
    }
    if (!ephemeral) return fail(502, "xai", "El servicio de voz no responde. Inténtalo en unos minutos.")

    const secret = randomToken(24)
    const { data: session, error } = await admin
      .from("voice_web_sessions")
      .insert({ workspace_id: workspaceId, secret_hash: await sha256Hex(secret), visitor_hash: visitor, origin: parent })
      .select("id")
      .single()
    if (error || !session) return fail(500, "session", "No se pudo iniciar la conversación.")

    const [{ data: ws }, tz] = await Promise.all([
      admin.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
      workspaceTimezone(admin, workspaceId),
    ])
    const today_ = new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeZone: tz }).format(new Date())
    return send({
      ok: true,
      token: ephemeral,
      model: MODEL,
      session_id: session.id,
      session_secret: secret,
      max_minutes: widget.minutes_per_session,
      session: {
        instructions: webInstructions((ws?.name as string | undefined) ?? "el negocio", config, today_),
        voice: VOICE,
        turn_detection: { type: "server_vad" },
        audio: { input: { format: { type: "audio/pcm", rate: 24000 } }, output: { format: { type: "audio/pcm", rate: 24000 } } },
        tools: webTools(config),
      },
    })
  }

  // tool / end: sesión válida.
  const sessionId = body.session_id
  const sessionSecret = typeof body.session_secret === "string" ? body.session_secret : ""
  if (!isUuid(sessionId) || !sessionSecret) return fail(401, "unauthorized", "Sesión no válida.")
  const { data: session } = await admin.from("voice_web_sessions").select("*").eq("id", sessionId).maybeSingle()
  if (!session || !sameToken(session.secret_hash as string, await sha256Hex(sessionSecret))) return fail(401, "unauthorized", "Sesión no válida.")

  if (body.action === "end") {
    await admin.from("voice_web_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId).is("ended_at", null)
    return send({ ok: true })
  }

  if (body.action === "tool") {
    const workspaceId = session.workspace_id as string
    const { data: widget } = await admin.from("voice_web_widgets").select("enabled, minutes_per_session").eq("workspace_id", workspaceId).maybeSingle()
    const ageMin = (Date.now() - new Date(session.started_at as string).getTime()) / 60_000
    if (!widget?.enabled || session.ended_at || ageMin > (widget.minutes_per_session as number) + 5) return fail(410, "expired", "La conversación terminó.")
    if ((session.tool_calls as number) >= MAX_TOOL_CALLS) return send({ ok: true, output: "Límite de consultas de esta conversación. Toma un mensaje para que el negocio contacte." })
    await admin.from("voice_web_sessions").update({ tool_calls: (session.tool_calls as number) + 1 }).eq("id", sessionId)

    const { data: integ } = await admin.from("integrations").select("id, status, config").eq("workspace_id", workspaceId).eq("provider", VOICE_PROVIDER).maybeSingle()
    if (!integ || integ.status !== "active") return fail(409, "no_voice", "El asistente de voz no está configurado.")
    const config = readVoiceConfig(integ.config)
    const name = typeof body.name === "string" ? body.name : ""
    if (!voiceTools(config).some((t) => t.name === name)) return send({ ok: true, output: "Herramienta desconocida." })
    let args: Record<string, unknown> = {}
    try {
      args = typeof body.arguments === "string" ? JSON.parse(body.arguments) : ((body.arguments as Record<string, unknown>) ?? {})
    } catch {
      args = {}
    }
    try {
      const output = await callVoiceTool({ admin, workspaceId, integrationId: integ.id as string, config, source: "web" }, name, args)
      return send({ ok: true, output })
    } catch (e) {
      if (!(e instanceof VoiceError)) console.error("voice-web", name, e instanceof Error ? e.name : "error")
      return send({ ok: true, output: e instanceof VoiceError ? e.message : "No se pudo completar. Toma un mensaje para que el negocio contacte." })
    }
  }

  return fail(400, "bad_request", "Acción no válida.")
})
