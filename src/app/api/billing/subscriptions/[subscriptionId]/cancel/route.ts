import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ subscriptionId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(_request: Request, context: RouteContext) {
  const { subscriptionId } = await context.params
  if (!UUID.test(subscriptionId)) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 })
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id, workspace_id")
    .eq("id", subscriptionId)
    .maybeSingle()
  if (subscriptionError || !subscription) {
    return NextResponse.json({ error: "subscription_not_found" }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("workspace_id", subscription.workspace_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (membership?.status !== "active" || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "billing_admin_required" }, { status: 403 })
  }

  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: { canceled?: boolean; reason?: string; canceled_at?: string } | null; error: { message: string } | null }>
  const { data, error } = await rpc("cancel_mexico_subscription_immediately", {
    p_subscription_id: subscriptionId,
  })
  if (error) {
    return NextResponse.json({ error: "cancellation_failed" }, { status: 409 })
  }
  if (!data?.canceled) {
    return NextResponse.json({
      error: "payment_provider_cancellation_required",
      message: "Esta suscripción requiere cancelar primero la renovación en el proveedor de pagos.",
    }, { status: 409 })
  }
  return NextResponse.json({ canceled: true, canceledAt: data.canceled_at }, {
    headers: { "Cache-Control": "no-store" },
  })
}
