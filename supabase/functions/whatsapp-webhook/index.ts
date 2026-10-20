// whatsapp-webhook: recibe los avisos de Meta para un espacio (?c=<integración>).
// Se despliega SIN verificación de JWT (Meta no envía uno); en su lugar:
//   * GET: comprueba el token de verificación y devuelve hub.challenge.
//   * POST: comprueba la firma X-Hub-Signature-256 con el secreto de la app.
// Registra los mensajes, actualiza estados de entrega y lanza los flujos
// activos con disparador "whatsapp_message". Las acciones que esos flujos
// propongan siguen esperando la aprobación de una persona.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, type RunRow } from "../_shared/agent.ts"
import { isUuid } from "../_shared/core.ts"
import { normalizePhone, parseSecret, safeEqual, validSignature, type WhatsAppConfig } from "../_shared/whatsapp.ts"

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

type Lookup = { workspace_id: string; provider: string; secret: string; status: string; config: WhatsAppConfig }

async function lookup(integrationId: string | null): Promise<Lookup | null> {
  if (!isUuid(integrationId)) return null
  const { data } = await admin.rpc("integration_secret_by_id", { p_integration_id: integrationId })
  const row = data?.[0] as Lookup | undefined
  return row && row.provider === "whatsapp" ? row : null
}

type IncomingMessage = { from?: string; id?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }
type Change = {
  value?: {
    metadata?: { phone_number_id?: string }
    contacts?: { wa_id?: string; profile?: { name?: string } }[]
    messages?: IncomingMessage[]
    statuses?: { id?: string; status?: string }[]
  }
}

function messageText(m: IncomingMessage): string {
  return m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ""
}

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
      // Avanza hasta la primera aprobación (o el final) sin retrasar la respuesta a Meta.
      if (claimed) await advance(admin, claimed, 60_000)
    } catch (e) {
      console.error("whatsapp-webhook launch", e instanceof Error ? e.name : "error")
    }
  }
}

async function processPayload(target: Lookup, integrationId: string, payload: { entry?: { changes?: Change[] }[] }) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value || value.metadata?.phone_number_id !== target.config.phone_number_id) continue

      for (const st of value.statuses ?? []) {
        if (st.id && st.status) {
          await admin.from("whatsapp_messages").update({ status: st.status.slice(0, 40) }).eq("wa_message_id", st.id).eq("workspace_id", target.workspace_id)
        }
      }

      for (const m of value.messages ?? []) {
        const from = normalizePhone(m.from ?? "")
        if (!m.id || from.length < 7) continue
        const name = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name?.slice(0, 200) ?? null
        const text = messageText(m).slice(0, 4096)
        const { data: inserted } = await admin
          .from("whatsapp_messages")
          .upsert(
            {
              workspace_id: target.workspace_id,
              integration_id: integrationId,
              direction: "in",
              phone: from,
              contact_name: name,
              body: text,
              message_type: (m.type ?? "unknown").slice(0, 40),
              wa_message_id: m.id.slice(0, 200),
              status: "received",
            },
            { onConflict: "wa_message_id", ignoreDuplicates: true },
          )
          .select("id")
        // Si ya estaba registrado (reintento de Meta), no se lanza nada otra vez.
        const messageId = inserted?.[0]?.id as number | undefined
        if (messageId && text.trim()) await launchFlows(target.workspace_id, from, name, messageId, text)
      }
    }
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const integrationId = url.searchParams.get("c")

  if (req.method === "GET") {
    const target = await lookup(integrationId)
    const secret = parseSecret(target?.secret)
    const token = url.searchParams.get("hub.verify_token") ?? ""
    if (url.searchParams.get("hub.mode") === "subscribe" && secret && safeEqual(token, secret.verify_token)) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } })
    }
    return new Response("Forbidden", { status: 403 })
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const raw = await req.text()
  if (raw.length > 1_000_000) return new Response("Payload too large", { status: 413 })
  const target = await lookup(integrationId)
  const secret = parseSecret(target?.secret)
  if (!target || !secret || target.status !== "active") return new Response("Not found", { status: 404 })
  if (!(await validSignature(secret.app_secret, raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 })
  }

  let payload: { entry?: { changes?: Change[] }[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  // Meta espera una respuesta rápida: el trabajo sigue en segundo plano.
  const work = processPayload(target, integrationId!, payload).catch((e) => {
    console.error("whatsapp-webhook", e instanceof Error ? e.name : "error")
  })
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work)
  else await work
  return new Response("ok", { status: 200 })
})
