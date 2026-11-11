-- Tighten the Billing & Compliance tables: anonymous clients do not need SQL privileges.
-- Authenticated access remains governed by the existing grants and RLS policies.
revoke all on public.billing_plans,
  public.plan_prices,
  public.billing_customers,
  public.legal_documents,
  public.checkout_sessions,
  public.subscriptions,
  public.payment_transactions,
  public.payment_events,
  public.consent_records,
  public.outbox_events,
  public.billing_audit_events
from anon;
