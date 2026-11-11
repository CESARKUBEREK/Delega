import type { Money } from "./types"

/**
 * Provider-neutral contract. Implementations must keep credentials server-side,
 * use provider idempotency keys and verify webhook signatures before returning
 * verified events. No card PAN/CVV may enter MarchaSolo.
 */
export type CreatePaymentRequest = {
  amount: Money
  customerReference: string
  successUrl: string
  cancelUrl: string
  idempotencyKey: string
  metadata: Record<string, string>
}

export type ProviderCheckout = {
  provider: string
  providerSessionId: string
  redirectUrl: string
  expiresAt: string
}

export type VerifiedPaymentEvent = {
  provider: string
  eventId: string
  eventType: string
  occurredAt: string
  payload: Record<string, unknown>
}

export type RefundRequest = {
  providerPaymentId: string
  amount?: Money
  reason: string
  idempotencyKey: string
}

export type ProviderRefund = {
  providerRefundId: string
  status: "pending" | "succeeded" | "failed"
}

export interface PaymentAdapter {
  readonly providerId: string
  createCheckout(request: CreatePaymentRequest): Promise<ProviderCheckout>
  verifyWebhook(rawBody: string, signature: string | null): Promise<VerifiedPaymentEvent>
  refund(request: RefundRequest): Promise<ProviderRefund>
}
