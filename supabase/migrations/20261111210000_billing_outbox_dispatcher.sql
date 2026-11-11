-- Durable, idempotent outbox dispatch with bounded retries and stale-lock recovery.
alter table public.outbox_events
  add column if not exists locked_at timestamptz;

create or replace function public.claim_outbox_events(p_limit integer default 25)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select e.id
    from public.outbox_events e
    where e.attempts < 8
      and (
        (e.status in ('pending', 'failed') and e.available_at <= now())
        or (e.status = 'processing' and e.locked_at < now() - interval '15 minutes')
      )
    order by e.available_at, e.created_at
    for update skip locked
    limit p_limit
  )
  update public.outbox_events e
  set status = 'processing',
      attempts = e.attempts + 1,
      locked_at = now(),
      last_error = null
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.finish_outbox_event(
  p_event_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts smallint;
begin
  select attempts into v_attempts
  from public.outbox_events
  where id = p_event_id and status = 'processing'
  for update;

  if not found then
    raise exception 'outbox_event_not_processing' using errcode = '22023';
  end if;

  if p_success then
    update public.outbox_events
    set status = 'published', published_at = now(), locked_at = null, last_error = null
    where id = p_event_id;
  else
    update public.outbox_events
    set status = 'failed',
        available_at = now() + make_interval(secs => least(3600, (30 * power(2, greatest(v_attempts - 1, 0)))::integer)),
        locked_at = null,
        last_error = left(coalesce(p_error, 'delivery_failed'), 1000)
    where id = p_event_id;
  end if;
end;
$$;

revoke all on function public.claim_outbox_events(integer) from public, anon, authenticated;
revoke all on function public.finish_outbox_event(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_outbox_events(integer) to service_role;
grant execute on function public.finish_outbox_event(uuid, boolean, text) to service_role;

-- Send both the internal alert and a receipt to the consumer. Delivery is handled by
-- the scheduled dispatcher; no email is sent from the public form request itself.
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
     'consumer-rights:' || new.id::text, now()),
    ('consumer_rights_request', new.id, 'legal.consumer_rights_request_acknowledgement',
     jsonb_build_object(
       'email', new.email,
       'full_name', new.full_name,
       'reference_code', new.reference_code,
       'request_type', new.request_type
     ),
     'consumer-rights-ack:' || new.id::text, now())
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function public.consumer_rights_request_notify() from public, anon, authenticated;
