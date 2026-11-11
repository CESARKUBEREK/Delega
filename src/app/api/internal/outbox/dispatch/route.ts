import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type OutboxEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!)
}

function text(payload: Record<string, unknown>, key: string, fallback = "") {
  const value = payload[key]
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback
}

function emailFor(event: OutboxEvent) {
  const payload = event.payload
  if (event.event_type === "legal.consumer_rights_request_received") {
    const reference = text(payload, "reference_code")
    const name = text(payload, "full_name")
    const email = text(payload, "email")
    const type = text(payload, "request_type") === "withdrawal" ? "arrepentimiento" : "baja"
    const deadline = text(payload, "response_deadline")
    return {
      to: ["legal@marchasolo.com"],
      subject: `Nueva solicitud argentina de ${type}: ${reference}`,
      text: [
        `Se recibió una solicitud de ${type} en MarchaSolo.`,
        `Referencia: ${reference}`, `Nombre: ${name}`, `Email: ${email}`,
        `Pedido/operación: ${text(payload, "order_reference", "No indicado")}`,
        `Fecha de recepción: ${text(payload, "submitted_at")}`,
        `Plazo interno de respuesta: ${deadline}`,
      ].join("\n"),
      html: `<h2>Nueva solicitud argentina</h2><p>Tipo: ${escapeHtml(type)}</p><p>Referencia: <strong>${escapeHtml(reference)}</strong></p><p>Nombre: ${escapeHtml(name)}</p><p>Email: ${escapeHtml(email)}</p><p>Operación: ${escapeHtml(text(payload, "order_reference", "No indicado"))}</p><p>Plazo de respuesta: ${escapeHtml(deadline)}</p>`,
    }
  }

  if (event.event_type === "legal.consumer_rights_request_acknowledgement") {
    const reference = text(payload, "reference_code")
    const name = text(payload, "full_name", "cliente")
    const type = text(payload, "request_type") === "withdrawal" ? "arrepentimiento" : "baja"
    return {
      to: [text(payload, "email")],
      subject: `Recibimos tu solicitud ${reference}`,
      text: `Hola ${name}: recibimos tu solicitud de ${type}. Tu número de referencia es ${reference}. Nuestro equipo la revisará y responderá dentro del plazo legal aplicable. Conservá este mensaje como comprobante.\n\nMarchaSolo · legal@marchasolo.com`,
      html: `<p>Hola ${escapeHtml(name)},</p><p>Recibimos tu solicitud de ${escapeHtml(type)}.</p><p>Tu número de referencia es <strong>${escapeHtml(reference)}</strong>.</p><p>Nuestro equipo la revisará y responderá dentro del plazo legal aplicable. Conservá este mensaje como comprobante.</p><p>MarchaSolo · legal@marchasolo.com</p>`,
    }
  }

  if (event.event_type === "billing.mx_renewal_notice_due") {
    const amountMinor = Number(payload.amount_minor)
    const currency = text(payload, "currency").trim()
    const amount = Number.isFinite(amountMinor)
      ? new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(amountMinor / 100)
      : "el importe indicado en tu cuenta"
    const renewalAt = text(payload, "renewal_at")
    const date = renewalAt ? new Date(renewalAt).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }) : "la fecha indicada en tu cuenta"
    return {
      to: [text(payload, "billing_email")],
      subject: "Aviso de renovación de tu suscripción MarchaSolo",
      text: `Te avisamos que tu suscripción MarchaSolo se renovará el ${date} por ${amount}. Podés revisar tu plan y gestionar la cancelación desde Facturación en tu espacio de MarchaSolo: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.marchasolo.com"}. Si ya cancelaste, podés ignorar este aviso.`,
      html: `<p>Te avisamos que tu suscripción MarchaSolo se renovará el <strong>${escapeHtml(date)}</strong> por <strong>${escapeHtml(amount)}</strong>.</p><p>Podés revisar tu plan y gestionar la cancelación desde <a href="${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.marchasolo.com")}/">MarchaSolo</a>.</p><p>Si ya cancelaste, podés ignorar este aviso.</p>`,
    }
  }

  throw new Error(`Unsupported outbox event type: ${event.event_type}`)
}

async function sendEmail(event: OutboxEvent) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error("Email delivery is not configured (RESEND_API_KEY and EMAIL_FROM required)")
  const message = emailFor(event)
  if (message.to.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
    throw new Error("Outbox event has an invalid recipient")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `marchasolo-outbox-${event.id}`,
    },
    body: JSON.stringify({ from, ...message }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`Email provider returned ${response.status}: ${detail}`)
  }
}

export async function GET(request: Request) {
  const secret = process.env.OUTBOX_CRON_SECRET
  const authorization = request.headers.get("authorization") ?? ""
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({ error: "email_delivery_not_configured" }, { status: 503 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("claim_outbox_events", { p_limit: 25 })
  if (error) {
    return NextResponse.json({ error: "outbox_claim_failed" }, { status: 500 })
  }

  const events = (data ?? []) as OutboxEvent[]
  let published = 0
  let failed = 0
  for (const event of events) {
    let success = false
    let failure: string | null = null
    try {
      await sendEmail(event)
      success = true
      published += 1
    } catch (error) {
      failure = error instanceof Error ? error.message : "Unknown delivery error"
      failed += 1
    }

    const { error: finishError } = await supabase.rpc("finish_outbox_event", {
      p_event_id: event.id,
      p_success: success,
      p_error: failure,
    })
    if (finishError) failed += 1
  }

  return NextResponse.json({ claimed: events.length, published, failed }, {
    headers: { "Cache-Control": "no-store" },
  })
}
