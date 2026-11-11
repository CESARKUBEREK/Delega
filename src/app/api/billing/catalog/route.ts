import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 })
  }

  const now = new Date().toISOString()
  const [{ data: plans, error: plansError }, { data: prices, error: pricesError }] = await Promise.all([
    supabase
      .from("billing_plans")
      .select("id, code, name, description, capabilities")
      .eq("active", true)
      .order("code"),
    supabase
      .from("plan_prices")
      .select("id, plan_id, market_code, currency, amount_minor, interval_unit, interval_count, valid_from, valid_until")
      .eq("active", true)
      .lte("valid_from", now)
      .or("valid_until.is.null,valid_until.gt." + now)
      .order("amount_minor"),
  ])

  if (plansError || pricesError) {
    return NextResponse.json({ error: "billing_catalog_unavailable" }, { status: 503 })
  }

  const activePlans = plans ?? []
  const planIds = new Set(activePlans.map((plan) => plan.id))
  return NextResponse.json({
    plans: activePlans.map((plan) => ({
      ...plan,
      prices: (prices ?? []).filter((price) => price.plan_id === plan.id && planIds.has(price.plan_id)),
    })),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
