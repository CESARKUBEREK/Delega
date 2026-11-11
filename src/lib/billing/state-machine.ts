import type { PaymentStatus, RefundStatus, SubscriptionStatus } from "./types"

const subscriptionTransitions: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  incomplete: ["trialing", "active", "incomplete_expired", "canceled"],
  trialing: ["active", "canceled", "expired"],
  active: ["past_due", "cancel_at_period_end", "canceled"],
  past_due: ["active", "suspended", "canceled"],
  suspended: ["active", "canceled"],
  cancel_at_period_end: ["active", "canceled"],
  canceled: [],
  expired: [],
  incomplete_expired: [],
}

const paymentTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["requires_action", "processing", "succeeded", "failed", "canceled"],
  requires_action: ["processing", "succeeded", "failed", "canceled"],
  processing: ["succeeded", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
}

const refundTransitions: Record<RefundStatus, readonly RefundStatus[]> = {
  requested: ["pending", "failed"],
  pending: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
}

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return subscriptionTransitions[from].includes(to)
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return paymentTransitions[from].includes(to)
}

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return refundTransitions[from].includes(to)
}

export function assertTransition<T extends string>(
  entity: "subscription" | "payment" | "refund",
  from: T,
  to: T,
  allowed: (from: T, to: T) => boolean,
): void {
  if (!allowed(from, to)) {
    throw new Error("Invalid " + entity + " transition: " + from + " -> " + to)
  }
}

export function transitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): SubscriptionStatus {
  assertTransition("subscription", from, to, canTransitionSubscription)
  return to
}

export function transitionPayment(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  assertTransition("payment", from, to, canTransitionPayment)
  return to
}

export function transitionRefund(from: RefundStatus, to: RefundStatus): RefundStatus {
  assertTransition("refund", from, to, canTransitionRefund)
  return to
}