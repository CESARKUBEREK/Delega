import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  // Honeypot: silently accept bots without creating a record.
  if (typeof input.website === "string" && input.website.length > 0) {
    return NextResponse.json({ reference: "AR-RECIBIDA" }, { status: 200 })
  }
  const requestType = input.requestType
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const orderReference = typeof input.orderReference === "string" ? input.orderReference.trim() : null
  const message = typeof input.message === "string" ? input.message.trim() : null
  if ((requestType !== "withdrawal" && requestType !== "cancellation") ||
      fullName.length < 2 || fullName.length > 160 || !EMAIL.test(email) || email.length > 254 ||
      (orderReference && orderReference.length > 120) || (message && message.length > 2000)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
  const ipHash = forwarded
    ? createHash("sha256").update(process.env.CONSUMER_RIGHTS_RATE_LIMIT_SALT ?? "marchasolo-consumer-rights").update(forwarded).digest("hex")
    : null
  const supabase = await createClient()
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>
  const { data, error } = await rpc("submit_consumer_rights_request", {
    p_request_type: requestType,
    p_full_name: fullName,
    p_email: email,
    p_order_reference: orderReference,
    p_message: message,
    p_ip_hash: ipHash,
  })
  if (error) {
    const limited = error.message.includes("rate_limit_exceeded")
    return NextResponse.json({ error: limited ? "rate_limit_exceeded" : "request_not_registered" }, { status: limited ? 429 : 503 })
  }
  return NextResponse.json({ reference: data }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  })
}
