-- Payment Orchestrator foundation (additive; preserves existing billing records).

alter table public.checkout_sessions
  add column if not exists provider text,
  add column if not exists provider_checkout_id text,
  add column if not exists checkout_url text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.checkout_sessions
  add constraint checkout_sessions_provider_check
  check (provider is null or provider in ('stripe', 'mercadopago_ar', 'mercadopago_mx'));

alter table public.checkout_sessions
  add constraint checkout_sessions_provider_metadata_object_check
  check (jsonb_typeof(provider_metadata) = 'object');

create unique index if not exists checkout_sessions_provider_checkout_id_unique
  on public.checkout_sessions (provider, provider_checkout_id)
  where provider is not null and provider_checkout_id is not null;

create table if not exists public.billing_provider_customers (
  id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid not null references public.billing_customers(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'mercadopago_ar', 'mercadopago_mx')),
  provider_customer_id text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_provider_customers_provider_customer_unique unique (provider, environment, provider_customer_id),
  constraint billing_provider_customers_customer_provider_unique unique (billing_customer_id, provider, environment),
  constraint billing_provider_customers_external_id_nonempty check (length(btrim(provider_customer_id)) > 0)
);

create index if not exists billing_provider_customers_customer_idx
  on public.billing_provider_customers (billing_customer_id, provider, environment);

alter table public.billing_provider_customers enable row level security;
revoke all on public.billing_provider_customers from public, anon, authenticated;
grant all on public.billing_provider_customers to service_role;

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'mercadopago_ar', 'mercadopago_mx')),
  provider_refund_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency character(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'requested' check (status in ('requested', 'pending', 'succeeded', 'failed')),
  reason text,
  requested_by uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_refunds_idempotency_unique unique (workspace_id, idempotency_key),
  constraint payment_refunds_idempotency_nonempty check (length(btrim(idempotency_key)) > 0)
);

create unique index if not exists payment_refunds_provider_refund_unique
  on public.payment_refunds (provider, provider_refund_id)
  where provider_refund_id is not null;

create index if not exists payment_refunds_transaction_created_idx
  on public.payment_refunds (payment_transaction_id, created_at desc);

create index if not exists payment_refunds_workspace_created_idx
  on public.payment_refunds (workspace_id, created_at desc);

alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from public, anon, authenticated;
grant all on public.payment_refunds to service_role;
