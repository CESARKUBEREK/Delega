// whatsapp-webhook: recibe los WhatsApp de los clientes de los proveedores con
// una URL por integración (?c=<integración>; hoy, Twilio). Se despliega SIN
// verificación de JWT (el proveedor no envía uno); en su lugar, el adaptador
// exige la firma del proveedor con las credenciales de la conexión.
//
// Todo lo específico del proveedor está en _shared/whatsapp/providers/; lo
// que se hace con cada mensaje, en _shared/whatsapp/ingest.ts.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { isUuid } from "../_shared/core.ts"
import { whatsappConnectionById } from "../_shared/whatsapp.ts"
import { ingestEvents } from "../_shared/whatsapp/ingest.ts"
import { getProvider } from "../_shared/whatsapp/registry.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const admin = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const search = new URL(req.url).search
  const integrationId = new URLSearchParams(search).get("c")
  if (!isUuid(integrationId)) return new Response("Not found", { status: 404 })

  const conn = await whatsappConnectionById(admin, integrationId)
  if (!conn) return new Response("Not found", { status: 404 })
  const provider = getProvider(conn.provider)

  const rawBody = await req.text()
  if (rawBody.length > 200_000) return new Response("Payload too large", { status: 413 })

  // La firma se calcula sobre la URL pública que tiene configurada el proveedor.
  const raw = { rawBody, headers: req.headers, url: `${SUPABASE_URL}/functions/v1/whatsapp-webhook${search}` }
  if (!(await provider.verifyWebhook(raw, conn))) return new Response("Forbidden", { status: 403 })

  const parsed = await provider.parseWebhook(raw, conn)
  const work = ingestEvents(admin, conn, parsed.events).catch((e) => console.error("whatsapp-webhook", e instanceof Error ? e.name : "error"))
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work)
  else await work

  const ack = provider.webhookAck()
  return new Response(ack.body, { status: ack.status, headers: { "Content-Type": ack.contentType } })
})
