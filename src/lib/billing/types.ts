export type CurrencyCode = string & { readonly __currencyCode: unique symbol }

export type Money = {
  amountMinor: number
  currency: CurrencyCode
}

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancel_at_period_end"
  | "canceled"
  | "expired"
  | "incomplete_expired"

export type PaymentStatus =
  | "created"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"

export type RefundStatus = "requested" | "pending" | "succeeded" | "failed"

export type BillingInterval = {
  unit: "month" | "year"
  count: number
}

export type BillingQuote = {
  planCode: "solo" | "pro" | "business"
  marketCode: string
  price: Money
  interval: BillingInterval
  taxAmountMinor: number | null
  totalAmountMinor: number | null
  taxStatus: "not_calculated" | "calculated"
  validUntil: string
}

export type ConsentEvidence = {
  documentType: string
  documentVersion: string
  documentSha256: string
  purpose:
    | "terms_acceptance"
    | "recurring_payment"
    | "immediate_service_start"
    | "withdrawal_acknowledgement"
    | "marketing"
  decision: "accepted" | "declined" | "withdrawn"
  recordedAt: string
}
