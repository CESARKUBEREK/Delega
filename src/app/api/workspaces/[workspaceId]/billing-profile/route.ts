import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

type RouteContext = { params: Promise<{ workspaceId: string }> }

const CUSTOMER_TYPES = new Set(["consumer", "professional", "business"])
const COUNTRY_CODE = /^[A-Z]{2}$/
const SUPPORTED_COUNTRIES = new Set(["ES", "AR", "MX", "DE", "IT", "PT", "NL", "BE", "IE", "AT", "PL", "SE", "DK", "FI", "GR", "CZ", "RO", "HU", "HR", "SK", "SI", "BG", "CY", "EE", "LV", "LT", "LU", "MT"])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function authorizeBillingAdmin(workspaceId: string) {
  if (!UUID_RE.test(workspaceId)) {
    return { response: NextResponse.json({ error: "invalid_workspace" }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (typeof userId !== "string") {
    return { response: NextResponse.json({ error: "authentication_required" }, { status: 401 }) }
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || membership?.status !== "active") {
    return { response: NextResponse.json({ error: "workspace_access_denied" }, { status: 403 }) }
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { response: NextResponse.json({ error: "billing_admin_required" }, { status: 403 }) }
  }

  return { supabase, userId }
}

export async function GET(_request: Request, context: RouteContext) {
  const { workspaceId } = await context.params
  const auth = await authorizeBillingAdmin(workspaceId)
  if ("response" in auth) return auth.response

  const { data, error } = await auth.supabase
    .from("billing_customers")
    .select("id, workspace_id, customer_type, legal_name, billing_email, country_code, region, city, postal_code, address_line1, address_line2, preferred_language, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "billing_profile_unavailable" }, { status: 503 })
  }

  return NextResponse.json({ profile: data }, {
    headers: { "Cache-Control": "private, no-store" },
  })
}

export async function PUT(request: Request, context: RouteContext) {
  const { workspaceId } = await context.params
  const auth = await authorizeBillingAdmin(workspaceId)
  if ("response" in auth) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_profile" }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const customerType = input.customer_type
  const countryCode = input.country_code
  const billingEmail = input.billing_email
  if (typeof customerType !== "string" || !CUSTOMER_TYPES.has(customerType)) {
    return NextResponse.json({ error: "invalid_customer_type" }, { status: 400 })
  }
  if (typeof countryCode !== "string" || !COUNTRY_CODE.test(countryCode) || !SUPPORTED_COUNTRIES.has(countryCode)) {
    return NextResponse.json({ error: "invalid_country_code" }, { status: 400 })
  }
  if (billingEmail !== null && billingEmail !== undefined &&
      (typeof billingEmail !== "string" || billingEmail.length > 254 || !EMAIL.test(billingEmail))) {
    return NextResponse.json({ error: "invalid_billing_email" }, { status: 400 })
  }

  const optionalText = (key: string, max: number): string | null => {
    const value = input[key]
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string" || value.trim().length > max) throw new Error(key)
    return value.trim()
  }

  let profile: {
    legal_name: string | null
    billing_email: string | null
    region: string | null
    city: string | null
    postal_code: string | null
    address_line1: string | null
    address_line2: string | null
  }
  try {
    profile = {
      legal_name: optionalText("legal_name", 200),
      billing_email: typeof billingEmail === "string" ? billingEmail.trim().toLowerCase() : null,
      region: optionalText("region", 100),
      city: optionalText("city", 100),
      postal_code: optionalText("postal_code", 30),
      address_line1: optionalText("address_line1", 200),
      address_line2: optionalText("address_line2", 200),
    }
  } catch (error) {
    return NextResponse.json({
      error: "invalid_field",
      field: error instanceof Error ? error.message : "unknown",
    }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("billing_customers")
    .upsert({
      workspace_id: workspaceId,
      owner_user_id: auth.userId,
      customer_type: customerType,
      country_code: countryCode,
      preferred_language: "es",
      ...profile,
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id" })
    .select("id, workspace_id, customer_type, legal_name, billing_email, country_code, region, city, postal_code, address_line1, address_line2, preferred_language, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "billing_profile_save_failed" }, { status: 503 })
  }

  return NextResponse.json({ profile: data }, { status: 200 })
}
