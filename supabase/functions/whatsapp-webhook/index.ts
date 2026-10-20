// whatsapp-webhook: recibe los avisos de Meta. Se despliega SIN verificación de
// JWT (Meta no envía uno); en su lugar se comprueba la firma de cada aviso.
//
// Dos modos:
//   * Central (sin parámetros): webhook de la app de Delega (Embedded Signup y
//     coexistencia). Token de verificación META_WEBHOOK_VERIFY_TOKEN y firma con
//     META_APP_SECRET. El espacio se deduce del phone_number_id del aviso.
//   * Manual (?c=<integración>): app de Meta propia del espacio, con su token
//     de verificación y su secreto guardados en Vault.
//
// Registra mensajes entrantes, ecos (lo que envías desde la app WhatsApp
// Business), el histórico de la coexistencia y los estados de entrega, y lanza
// los flujos activos con disparador "whatsapp_message".
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, type RunRow } from "../_shared/agent.ts"
import { isUuid } from "../_shared/core.ts"
import { metaPlatform, normalizePhone, parseSecret, safeEqual, validSignature, type WhatsAppConfig } from "../_shared/whatsapp.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const MAX_RUNS_PER_HOUR = 30

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

const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Target = { integration_id: string; workspace_id: string; secret: string; status: string; config: WhatsAppConfig }

async function byIntegration(id: string | null): Promise<Target | null> {
  if (!isUuid(id)) return null
  const { data } = await admin.rpc("integration_secret_by_id", { p_integration_id: id })
  const row = data?.[0] as (Omit<Target, "integration_id"> & { provider: string }) | undefined
  return row && row.provider === "whatsapp" ? { ...row, integration_id: id } : null
}

const targetCache = new Map<string, Target | null>()
async function byPhoneNumberId(phoneNumberId: string): Promise<Target | null> {
  if (targetCache.has(phoneNumberId)) return targetCache.get(phoneNumberId)!
  const { data } = await admin.rpc("integration_by_phone_number_id", { p_phone_number_id: phoneNumberId })
  const row = (data?.[0] as Target | undefined) ?? null
  targetCache.set(phoneNumberId, row)
  return row
}

// ---------------------------------------------------------------------------
// Formas de los avisos (se leen con cuidado: Meta añade campos a menudo)
// ---------------------------------------------------------------------------
type WaMessage = {
  from?: string
  to?: string
  id?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }
  image?: { caption?: string }
  document?: { caption?: string; filename?: string }
  video?: { caption?: string }
}
type Value = {
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: WaMessage[]
  statuses?: { id?: string; status?: string }[]
  message_echoes?: WaMessage[]
  history?: unknown
  state_sync?: { contact?: { phone_number?: string; full_name?: string; first_name?: string } }[]
  event?: string
}
type Change = { field?: string; value?: Value }
type Payload = { entry?: { changes?: Change[] }[] }

function messageText(m: WaMessage): string {
  return (
    m.text?.body ??
      m.button?.text ??
      m.interactive?.button_reply?.title ??
      m.interactive?.list_reply?.title ??
      m.image?.caption ??
      m.video?.caption ??
      (m.document ? `[documento] ${m.document.caption ?? m.document.filename ?? ""}`.trim() : "") ??
      ""
  ).slice(0, 4096)
}

function when(ts: string | undefined): string {
  const n = Number(ts)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString()
}

async function record(t: Target, counterpart: string, name: string | null, direction: "in" | "out", source: string, m: WaMessage) {
  if (!m.id || counterpart.length < 7) return null
  const { data } = await admin.rpc("whatsapp_record_message", {
    p_workspace_id: t.workspace_id,
    p_integration_id: t.integration_id,
    p_counterpart: counterpart,
    p_contact_name: name ?? "",
    p_direction: direction,
    p_source: source,
    p_body: messageText(m),
    p_type: (m.type ?? "unknown").slice(0, 40),
    p_wa_message_id: m.id.slice(0, 200),
    p_sent_at: when(m.timestamp),
    p_status: direction === "in" ? "received" : "sent",
  })
  return (data as number | null) ?? null
}

// ---------------------------------------------------------------------------
// Flujos con disparador "whatsapp_message"
// ---------------------------------------------------------------------------
async function launchFlows(workspaceId: string, from: string, name: string | null, messageId: number, text: string) {
  const { data: flows } = await admin
    .from("flows")
    .select("id, name, definition, created_by, settings")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("definition->trigger->>type", "whatsapp_message")
    .limit(3)
  if (!flows?.length) return

  const { data: ai } = await admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: "openai" })
  const conn = ai?.[0] as { model: string; status: string } | undefined
  if (!conn || conn.status !== "active") return

  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "whatsapp_message")
    .gte("started_at", since)
  let budget = MAX_RUNS_PER_HOUR - (count ?? 0)

  for (const flow of flows) {
    if (budget-- <= 0) break
    const settings = (flow.settings ?? {}) as { file_ids?: unknown }
    const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
    try {
      const run = await createRun(admin, {
        workspaceId,
        flow,
        fileIds,
        note: "",
        model: conn.model,
        startedBy: flow.created_by,
        trigger: { type: "whatsapp_message", from, name, message_id: messageId, text },
      })
      await admin.from("whatsapp_messages").update({ run_id: run.id }).eq("id", messageId)
      const claimed: RunRow | null = await claim(admin, run.id, "running")
      if (claimed) await advance(admin, claimed, 60_000)
    } catch (e) {
      console.error("whatsapp-webhook launch", e instanceof Error ? e.name : "error")
    }
  }
}

// ---------------------------------------------------------------------------
// Procesar un aviso
// ---------------------------------------------------------------------------
type HistoryChunk = { threads?: { id?: string; messages?: WaMessage[] }[]; errors?: unknown }

async function processChange(t: Target, change: Change) {
  const value = change.value
  if (!value) return

  // Cuenta desvinculada desde la app WhatsApp Business o desde Meta.
  if (change.field === "account_update" && value.event === "PARTNER_REMOVED") {
    await admin.rpc("integration_mark_invalid", { p_workspace_id: t.workspace_id, p_provider: "whatsapp" })
    return
  }

  for (const st of value.statuses ?? []) {
    if (st.id && st.status) {
      await admin.from("whatsapp_messages").update({ status: st.status.slice(0, 40) }).eq("wa_message_id", st.id).eq("workspace_id", t.workspace_id)
    }
  }

  // Mensajes entrantes en directo.
  for (const m of value.messages ?? []) {
    const from = normalizePhone(m.from ?? "")
    const name = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name?.slice(0, 200) ?? null
    const id = await record(t, from, name, "in", "live", m)
    const text = messageText(m)
    if (id && text.trim()) await launchFlows(t.workspace_id, from, name, id, text)
  }

  // Ecos: lo que envías tú desde la app WhatsApp Business (coexistencia).
  for (const m of value.message_echoes ?? []) {
    await record(t, normalizePhone(m.to ?? ""), null, "out", "echo", m)
  }

  // Histórico de la coexistencia (hasta 6 meses, llega por partes).
  if (value.history) {
    const chunks = (Array.isArray(value.history) ? value.history : [value.history]) as HistoryChunk[]
    for (const chunk of chunks) {
      for (const thread of chunk.threads ?? []) {
        const counterpart = normalizePhone(thread.id ?? "")
        for (const m of thread.messages ?? []) {
          const fromCounterpart = normalizePhone(m.from ?? "") === counterpart
          await record(t, counterpart, null, fromCounterpart ? "in" : "out", "history", m)
        }
      }
    }
  }

  // Contactos de la app: solo se usan para poner nombre a las conversaciones.
  for (const s of value.state_sync ?? []) {
    const phone = normalizePhone(s.contact?.phone_number ?? "")
    const name = (s.contact?.full_name ?? s.contact?.first_name ?? "").slice(0, 200)
    if (phone.length >= 7 && name) {
      await admin.from("whatsapp_threads").update({ contact_name: name }).eq("workspace_id", t.workspace_id).eq("phone", phone)
    }
  }
}

async function processPayload(payload: Payload, fixed: Target | null) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id
      const target = fixed ?? (phoneNumberId ? await byPhoneNumberId(phoneNumberId) : null)
      if (!target || target.status !== "active") continue
      if (phoneNumberId && phoneNumberId !== target.config.phone_number_id) continue
      try {
        await processChange(target, change)
      } catch (e) {
        console.error("whatsapp-webhook change", e instanceof Error ? e.name : "error")
      }
    }
  }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const integrationId = url.searchParams.get("c")
  const platform = metaPlatform()

  if (req.method === "GET") {
    const token = url.searchParams.get("hub.verify_token") ?? ""
    let expected: string | undefined
    if (integrationId) expected = parseSecret((await byIntegration(integrationId))?.secret)?.verify_token
    else expected = platform?.verifyToken
    if (url.searchParams.get("hub.mode") === "subscribe" && expected && safeEqual(token, expected)) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } })
    }
    return new Response("Forbidden", { status: 403 })
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const raw = await req.text()
  if (raw.length > 5_000_000) return new Response("Payload too large", { status: 413 })

  let fixed: Target | null = null
  let appSecret: string | undefined
  if (integrationId) {
    fixed = await byIntegration(integrationId)
    appSecret = parseSecret(fixed?.secret)?.app_secret
    if (!fixed || !appSecret) return new Response("Not found", { status: 404 })
  } else {
    appSecret = platform?.appSecret
    if (!appSecret) return new Response("Not configured", { status: 503 })
  }
  if (!(await validSignature(appSecret, raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 })
  }

  let payload: Payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  // Meta espera una respuesta rápida: el trabajo sigue en segundo plano.
  const work = processPayload(payload, fixed).catch((e) => console.error("whatsapp-webhook", e instanceof Error ? e.name : "error"))
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work)
  else await work
  return new Response("ok", { status: 200 })
})
