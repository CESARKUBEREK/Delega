-- MarchaSolo Billing & Compliance — Phase 1 foundation.
-- Additive only: does not alter existing workspace, authentication or trial tables.
-- Financial operations remain disabled until a payment provider is selected and reviewed.

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  market_code text not null default 'GLOBAL' check (market_code ~ '^[A-Z]{2,8}$'),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  interval_unit text not null check (interval_unit in ('month', 'year')),
  interval_count smallint not null default 1 check (interval_count between 1 and 12),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (plan_id, market_code, currency, interval_unit, interval_count, valid_from)
);

create index plan_prices_lookup_idx
  on public.plan_prices (market_code, currency, active, valid_from desc);

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete restrict,
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_type text not null check (customer_type in ('consumer', 'professional', 'business')),
  legal_name text,
  billing_email text,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  region text,
  city text,
  postal_code text,
  address_line1 text,
  address_line2 text,
  tax_id text,
  tax_id_type text,
  tax_id_verified_at timestamptz,
  preferred_language text not null default 'es' check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy', 'withdrawal_information', 'recurring_payment_notice', 'other')),
  jurisdiction text not null default 'GLOBAL',
  language text not null check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  version text not null check (char_length(version) between 1 and 40),
  title text not null check (char_length(title) between 1 and 200),
  content text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  effective_from timestamptz not null,
  effective_until timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  unique (document_type, jurisdiction, language, version)
);

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  billing_customer_id uuid not null references public.billing_customers(id) on delete restrict,
  plan_price_id uuid not null references public.plan_prices(id) on delete restrict,
  status text not null default 'created' check (status in ('created', 'requires_action', 'processing', 'completed', 'expired', 'canceled', 'failed')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  quote_snapshot jsonb not null check (jsonb_typeof(quote_snapshot) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (id, workspace_id)
);

create index checkout_sessions_workspace_created_idx
  on public.checkout_sessions (workspace_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  billing_customer_id uuid not null references public.billing_customers(id) on delete restrict,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  plan_price_id uuid not null references public.plan_prices(id) on delete restrict,
  provider text,
  provider_subscription_id text,
  status text not null default 'incomplete' check (status in ('incomplete', 'trialing', 'active', 'past_due', 'suspended', 'cancel_at_period_end', 'canceled', 'expired', 'incomplete_expired')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_requested_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (trial_end is null or trial_start is null or trial_end > trial_start),
  unique (id, workspace_id)
);

create unique index subscriptions_provider_id_unique
  on public.subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create index subscriptions_workspace_status_idx
  on public.subscriptions (workspace_id, status, created_at desc);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  subscription_id uuid,
  checkout_session_id uuid,
  provider text,
  provider_payment_id text,
  status text not null default 'created' check (status in ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  failure_code text,
  failure_message text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (subscription_id, workspace_id) references public.subscriptions(id, workspace_id) on delete restrict,
  foreign key (checkout_session_id, workspace_id) references public.checkout_sessions(id, workspace_id) on delete restrict,
  unique (workspace_id, idempotency_key)
);

create unique index payment_transactions_provider_id_unique
  on public.payment_transactions (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create index payment_transactions_workspace_created_idx
  on public.payment_transactions (workspace_id, created_at desc);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  signature_valid boolean not null default false,
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index payment_events_pending_idx
  on public.payment_events (received_at)
  where processing_status in ('received', 'failed');

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  checkout_session_id uuid,
  legal_document_id uuid references public.legal_documents(id) on delete restrict,
  document_type text not null,
  document_version text not null,
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  purpose text not null check (purpose in ('terms_acceptance', 'recurring_payment', 'immediate_service_start', 'withdrawal_acknowledgement', 'marketing')),
  decision text not null check (decision in ('accepted', 'declined', 'withdrawn')),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  recorded_at timestamptz not null default now(),
  foreign key (checkout_session_id, workspace_id) references public.checkout_sessions(id, workspace_id) on delete restrict
);

create index consent_records_workspace_recorded_idx
  on public.consent_records (workspace_id, recorded_at desc);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'published', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_events_pending_idx
  on public.outbox_events (available_at, created_at)
  where status in ('pending', 'failed');

create table public.billing_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index billing_audit_workspace_created_idx
  on public.billing_audit_events (workspace_id, created_at desc);

-- No client writes to financial records. The application server uses service_role
-- only after authenticating the user and checking workspace permissions.
alter table public.billing_plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.billing_customers enable row level security;
alter table public.legal_documents enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_events enable row level security;
alter table public.consent_records enable row level security;
alter table public.outbox_events enable row level security;
alter table public.billing_audit_events enable row level security;

create policy billing_customers_select_billing_admin
  on public.billing_customers for select to authenticated
  using (private.has_role(workspace_id, 'owner'::public.workspace_role)
      or private.has_role(workspace_id, 'admin'::public.workspace_role));

create policy checkout_sessions_select_billing_admin
  on public.checkout_sessions for select to authenticated
  using (private.has_role(workspace_id, 'owner'::public.workspace_role)
      or private.has_role(workspace_id, 'admin'::public.workspace_role));

create policy subscriptions_select_billing_admin
  on public.subscriptions for select to authenticated
  using (private.has_role(workspace_id, 'owner'::public.workspace_role)
      or private.has_role(workspace_id, 'admin'::public.workspace_role));

create policy payment_transactions_select_billing_admin
  on public.payment_transactions for select to authenticated
  using (private.has_role(workspace_id, 'owner'::public.workspace_role)
      or private.has_role(workspace_id, 'admin'::public.workspace_role));

create policy consent_records_select_billing_admin
  on public.consent_records for select to authenticated
  using (private.has_role(workspace_id, 'owner'::public.workspace_role)
      or private.has_role(workspace_id, 'admin'::public.workspace_role));

create policy billing_audit_events_select_billing_admin
  on public.billing_audit_events for select to authenticated
  using (workspace_id is not null and
        (private.has_role(workspace_id, 'owner'::public.workspace_role)
         or private.has_role(workspace_id, 'admin'::public.workspace_role)));

-- Global catalog, legal source documents, webhook inbox and outbox are server-only.
revoke all on public.billing_plans, public.plan_prices, public.legal_documents,
  public.payment_events, public.outbox_events from anon, authenticated;
revoke insert, update, delete on public.billing_customers, public.checkout_sessions,
  public.subscriptions, public.payment_transactions, public.consent_records,
  public.billing_audit_events from anon, authenticated;
grant select on public.billing_customers, public.checkout_sessions,
  public.subscriptions, public.payment_transactions, public.consent_records,
  public.billing_audit_events to authenticated;
grant all on public.billing_plans, public.plan_prices, public.billing_customers,
  public.legal_documents, public.checkout_sessions, public.subscriptions,
  public.payment_transactions, public.payment_events, public.consent_records,
  public.outbox_events, public.billing_audit_events to service_role;

insert into public.billing_plans (code, name, description, capabilities)
values
  ('solo', 'MarchaSolo Solo', 'Automatizar las tareas cotidianas.', '{"active_automations":5,"workspaces_users":1}'::jsonb),
  ('pro', 'MarchaSolo Pro', 'Coordinar procesos y varias aplicaciones.', '{"active_automations":20,"multi_step_flows":true}'::jsonb),
  ('business', 'MarchaSolo Business', 'Gestionar automatizaciones y trabajo en equipo.', '{"active_automations":50,"team_users":true}'::jsonb)
on conflict (code) do nothing;

insert into public.plan_prices (plan_id, market_code, currency, amount_minor, interval_unit, interval_count)
select p.id, 'GLOBAL', 'USD', v.amount_minor, v.interval_unit, 1
from public.billing_plans p
join (values
  ('solo', 1900::bigint, 'month'::text),
  ('solo', 22800::bigint, 'year'::text),
  ('pro', 3900::bigint, 'month'::text),
  ('pro', 46800::bigint, 'year'::text),
  ('business', 7900::bigint, 'month'::text),
  ('business', 94800::bigint, 'year'::text)
) as v(plan_code, amount_minor, interval_unit) on v.plan_code = p.code
where not exists (
  select 1 from public.plan_prices pp
  where pp.plan_id = p.id and pp.market_code = 'GLOBAL'
    and pp.currency = 'USD' and pp.amount_minor = v.amount_minor
    and pp.interval_unit = v.interval_unit and pp.interval_count = 1
);
