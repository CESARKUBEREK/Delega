-- Consumer rights intake and Mexico renewal/cancellation safeguards.
-- Public requests are submitted through a narrowly scoped SECURITY DEFINER RPC.
-- No anonymous table access is granted.

create table public.consumer_rights_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  request_type text not null check (request_type in ('withdrawal', 'cancellation')),
  country_code char(2) not null check (country_code = 'AR'),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  email text not null check (char_length(email) <= 254),
  order_reference text,
  message text,
  status text not null default 'received' check (status in ('received', 'in_review', 'completed', 'rejected')),
  ip_hash text,
  submitted_at timestamptz not null default now(),
  responded_at timestamptz,
  response_notes text
);
create index consumer_rights_requests_queue_idx
  on public.consumer_rights_requests (submitted_at) where status in ('received', 'in_review');
create index consumer_rights_requests_email_idx
  on public.consumer_rights_requests (lower(email), submitted_at desc);

alter table public.consumer_rights_requests enable row level security;
revoke all on public.consumer_rights_requests from public, anon, authenticated;
grant all on public.consumer_rights_requests to service_role;

create or replace function public.submit_consumer_rights_request(
  p_request_type text,
  p_full_name text,
  p_email text,
  p_order_reference text default null,
  p_message text default null,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_ip text := nullif(btrim(coalesce(p_ip_hash, '')), '');
begin
  if p_request_type not in ('withdrawal', 'cancellation') then
    raise exception 'invalid_request_type' using errcode = '22023';
  end if;
  if v_name !~ '^.{2,160}$' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 then
    raise exception 'invalid_contact_details' using errcode = '22023';
  end if;
  if p_order_reference is not null and length(p_order_reference) > 120 then
    raise exception 'invalid_order_reference' using errcode = '22023';
  end if;
  if p_message is not null and length(p_message) > 2000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  if v_ip is not null and v_ip !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_ip_hash' using errcode = '22023';
  end if;
  if (select count(*) from public.consumer_rights_requests r
      where lower(r.email) = v_email and r.submitted_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  if v_ip is not null and (select count(*) from public.consumer_rights_requests r
      where r.ip_hash = v_ip and r.submitted_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  v_reference := 'AR-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.consumer_rights_requests
    (reference_code, request_type, country_code, full_name, email, order_reference, message, ip_hash)
  values
    (v_reference, p_request_type, 'AR', v_name, v_email,
     nullif(btrim(coalesce(p_order_reference, '')), ''),
     nullif(btrim(coalesce(p_message, '')), ''), v_ip);
  return v_reference;
end;
$$;

revoke all on function public.submit_consumer_rights_request(text, text, text, text, text, text) from public;
grant execute on function public.submit_consumer_rights_request(text, text, text, text, text, text) to anon, authenticated;

-- Queue the statutory Mexican renewal reminder five calendar days before renewal.
-- Delivery is performed by the billing outbox worker once an email provider is configured.
create or replace function public.billing_queue_mexico_renewal_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country char(2);
  v_email text;
begin
  select bc.country_code, bc.billing_email
    into v_country, v_email
  from public.billing_customers bc
  where bc.id = new.billing_customer_id and bc.workspace_id = new.workspace_id;

  if v_country = 'MX' and v_email is not null
     and new.status in ('active', 'trialing')
     and new.current_period_end is not null
     and (tg_op = 'INSERT' or new.current_period_end is distinct from old.current_period_end
          or new.status is distinct from old.status) then
    insert into public.outbox_events
      (aggregate_type, aggregate_id, event_type, payload, dedupe_key, available_at)
    values
      ('subscription', new.id, 'billing.mx_renewal_notice_due',
       jsonb_build_object(
         'subscription_id', new.id,
         'workspace_id', new.workspace_id,
         'billing_email', v_email,
         'amount_minor', new.amount_minor,
         'currency', new.currency,
         'renewal_at', new.current_period_end,
         'notice_deadline', new.current_period_end - interval '5 days'
       ),
       'mx-renewal:' || new.id::text || ':' || extract(epoch from new.current_period_end)::bigint::text,
       greatest(now(), new.current_period_end - interval '5 days'))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_mx_renewal_notice on public.subscriptions;
create trigger subscriptions_mx_renewal_notice
  after insert or update of current_period_end, status on public.subscriptions
  for each row execute function public.billing_queue_mexico_renewal_notice();
revoke all on function public.billing_queue_mexico_renewal_notice() from public, anon, authenticated;

-- Mexico: immediate local cancellation is allowed only when no external payment
-- subscription exists. Provider-backed subscriptions must be canceled at the
-- payment processor first; this RPC refuses to create a false local success.
create or replace function public.cancel_mexico_subscription_immediately(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_country char(2);
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select s.* into v_sub
  from public.subscriptions s
  join public.memberships m on m.workspace_id = s.workspace_id
  where s.id = p_subscription_id and m.user_id = v_user and m.status = 'active'
    and m.role in ('owner', 'admin')
  for update of s;

  if not found then
    raise exception 'subscription_not_found_or_forbidden' using errcode = '42501';
  end if;
  select bc.country_code into v_country
  from public.billing_customers bc
  where bc.id = v_sub.billing_customer_id and bc.workspace_id = v_sub.workspace_id;

  if v_country <> 'MX' then
    raise exception 'mexico_only' using errcode = '22023';
  end if;
  if v_sub.status not in ('active', 'trialing', 'past_due', 'cancel_at_period_end') then
    raise exception 'subscription_not_cancellable' using errcode = '22023';
  end if;
  if v_sub.provider is not null or v_sub.provider_subscription_id is not null then
    return jsonb_build_object('canceled', false, 'reason', 'payment_provider_cancellation_required');
  end if;

  update public.subscriptions
  set status = 'canceled', cancel_at_period_end = false,
      cancel_requested_at = now(), canceled_at = now(), ended_at = now(), updated_at = now()
  where id = p_subscription_id;

  insert into public.billing_audit_events (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (v_sub.workspace_id, v_user, 'subscription.canceled_immediately',
          'subscription', p_subscription_id::text, jsonb_build_object('country_code', 'MX'));

  return jsonb_build_object('canceled', true, 'canceled_at', now());
end;
$$;
revoke all on function public.cancel_mexico_subscription_immediately(uuid) from public, anon;
grant execute on function public.cancel_mexico_subscription_immediately(uuid) to authenticated;


-- Alert the legal operations inbox immediately; an outbox worker must deliver it
-- and track the 24-hour response SLA. The public form never exposes this queue.
create or replace function public.consumer_rights_request_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.outbox_events
    (aggregate_type, aggregate_id, event_type, payload, dedupe_key, available_at)
  values
    ('consumer_rights_request', new.id, 'legal.consumer_rights_request_received',
     jsonb_build_object(
       'to_email', 'legal@marchasolo.com',
       'reference_code', new.reference_code,
       'request_type', new.request_type,
       'full_name', new.full_name,
       'email', new.email,
       'order_reference', new.order_reference,
       'submitted_at', new.submitted_at,
       'response_deadline', new.submitted_at + interval '24 hours'
     ),
     'consumer-rights:' || new.id::text, now())
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists consumer_rights_request_notify on public.consumer_rights_requests;
create trigger consumer_rights_request_notify
  after insert on public.consumer_rights_requests
  for each row execute function public.consumer_rights_request_notify();
revoke all on function public.consumer_rights_request_notify() from public, anon, authenticated;
 then
    raise exception 'invalid_ip_hash' using errcode = '22023';
  end if;
  if (select count(*) from public.consumer_rights_requests r
      where lower(r.email) = v_email and r.submitted_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  if v_ip is not null and (select count(*) from public.consumer_rights_requests r
      where r.ip_hash = v_ip and r.submitted_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  v_reference := 'AR-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.consumer_rights_requests
    (reference_code, request_type, country_code, full_name, email, order_reference, message, ip_hash)
  values
    (v_reference, p_request_type, 'AR', v_name, v_email,
     nullif(btrim(coalesce(p_order_reference, '')), ''),
     nullif(btrim(coalesce(p_message, '')), ''), v_ip);
  return v_reference;
end;
$$;

revoke all on function public.submit_consumer_rights_request(text, text, text, text, text, text) from public;
grant execute on function public.submit_consumer_rights_request(text, text, text, text, text, text) to anon, authenticated;

-- Queue the statutory Mexican renewal reminder five calendar days before renewal.
-- Delivery is performed by the billing outbox worker once an email provider is configured.
create or replace function public.billing_queue_mexico_renewal_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country char(2);
  v_email text;
begin
  select bc.country_code, bc.billing_email
    into v_country, v_email
  from public.billing_customers bc
  where bc.id = new.billing_customer_id and bc.workspace_id = new.workspace_id;

  if v_country = 'MX' and v_email is not null
     and new.status in ('active', 'trialing')
     and new.current_period_end is not null
     and (tg_op = 'INSERT' or new.current_period_end is distinct from old.current_period_end
          or new.status is distinct from old.status) then
    insert into public.outbox_events
      (aggregate_type, aggregate_id, event_type, payload, dedupe_key, available_at)
    values
      ('subscription', new.id, 'billing.mx_renewal_notice_due',
       jsonb_build_object(
         'subscription_id', new.id,
         'workspace_id', new.workspace_id,
         'billing_email', v_email,
         'amount_minor', new.amount_minor,
         'currency', new.currency,
         'renewal_at', new.current_period_end,
         'notice_deadline', new.current_period_end - interval '5 days'
       ),
       'mx-renewal:' || new.id::text || ':' || extract(epoch from new.current_period_end)::bigint::text,
       greatest(now(), new.current_period_end - interval '5 days'))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_mx_renewal_notice on public.subscriptions;
create trigger subscriptions_mx_renewal_notice
  after insert or update of current_period_end, status on public.subscriptions
  for each row execute function public.billing_queue_mexico_renewal_notice();
revoke all on function public.billing_queue_mexico_renewal_notice() from public, anon, authenticated;

-- Mexico: immediate local cancellation is allowed only when no external payment
-- subscription exists. Provider-backed subscriptions must be canceled at the
-- payment processor first; this RPC refuses to create a false local success.
create or replace function public.cancel_mexico_subscription_immediately(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_country char(2);
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select s.* into v_sub
  from public.subscriptions s
  join public.memberships m on m.workspace_id = s.workspace_id
  where s.id = p_subscription_id and m.user_id = v_user and m.status = 'active'
    and m.role in ('owner', 'admin')
  for update of s;

  if not found then
    raise exception 'subscription_not_found_or_forbidden' using errcode = '42501';
  end if;
  select bc.country_code into v_country
  from public.billing_customers bc
  where bc.id = v_sub.billing_customer_id and bc.workspace_id = v_sub.workspace_id;

  if v_country <> 'MX' then
    raise exception 'mexico_only' using errcode = '22023';
  end if;
  if v_sub.status not in ('active', 'trialing', 'past_due', 'cancel_at_period_end') then
    raise exception 'subscription_not_cancellable' using errcode = '22023';
  end if;
  if v_sub.provider is not null or v_sub.provider_subscription_id is not null then
    return jsonb_build_object('canceled', false, 'reason', 'payment_provider_cancellation_required');
  end if;

  update public.subscriptions
  set status = 'canceled', cancel_at_period_end = false,
      cancel_requested_at = now(), canceled_at = now(), ended_at = now(), updated_at = now()
  where id = p_subscription_id;

  insert into public.billing_audit_events (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (v_sub.workspace_id, v_user, 'subscription.canceled_immediately',
          'subscription', p_subscription_id::text, jsonb_build_object('country_code', 'MX'));

  return jsonb_build_object('canceled', true, 'canceled_at', now());
end;
$$;
revoke all on function public.cancel_mexico_subscription_immediately(uuid) from public, anon;
grant execute on function public.cancel_mexico_subscription_immediately(uuid) to authenticated;


-- Alert the legal operations inbox immediately; an outbox worker must deliver it
-- and track the 24-hour response SLA. The public form never exposes this queue.
create or replace function public.consumer_rights_request_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.outbox_events
    (aggregate_type, aggregate_id, event_type, payload, dedupe_key, available_at)
  values
    ('consumer_rights_request', new.id, 'legal.consumer_rights_request_received',
     jsonb_build_object(
       'to_email', 'legal@marchasolo.com',
       'reference_code', new.reference_code,
       'request_type', new.request_type,
       'full_name', new.full_name,
       'email', new.email,
       'order_reference', new.order_reference,
       'submitted_at', new.submitted_at,
       'response_deadline', new.submitted_at + interval '24 hours'
     ),
     'consumer-rights:' || new.id::text, now())
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists consumer_rights_request_notify on public.consumer_rights_requests;
create trigger consumer_rights_request_notify
  after insert on public.consumer_rights_requests
  for each row execute function public.consumer_rights_request_notify();
revoke all on function public.consumer_rights_request_notify() from public, anon, authenticated;
