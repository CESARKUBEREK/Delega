-- IA incluida en los planes (decisión de Cesar, 11 nov). Fase P1: medición.
-- Ver claude/spec-precios-ia-incluida.md (proyecto) secciones 2, 3.2 y 3.3.
--
-- - workspace_usage_periods: cupo de tareas y tope en USD de cada periodo de un
--   plan (o de una concesión manual de MarchaSolo, source = 'grant').
-- - usage_current / usage_consume / usage_open_period / usage_period_roll.
-- - billing_plans.capabilities: tareas y tope en USD de cada plan.
-- - workspace_trial_credits.expires_at: la prueba dura 14 días o 1 USD.
--
-- Nada de esto cambia el comportamiento mientras INCLUDED_AI_ENABLED no esté a
-- "true" en las funciones: el router solo usa la IA incluida con ese interruptor.

-- ---------------------------------------------------------------------------
-- Cupos de cada plan (solo datos; nombres y precios van en la fase P2)
-- ---------------------------------------------------------------------------
update public.billing_plans
   set capabilities = capabilities || v.caps,
       updated_at = now()
  from (values
    ('solo',     '{"monthly_tasks":200,  "period_usd_cap":10, "active_automations":5,  "users_included":1, "channels":["email","telegram"],             "voice_web":false, "shared_processes":false, "byok_unlimited":true}'::jsonb),
    ('pro',      '{"monthly_tasks":600,  "period_usd_cap":30, "active_automations":20, "users_included":2, "channels":["email","telegram","whatsapp"], "voice_web":true,  "shared_processes":false, "byok_unlimited":true}'::jsonb),
    ('business', '{"monthly_tasks":1500, "period_usd_cap":75, "active_automations":50, "users_included":5, "extra_user_usd":12, "channels":["email","telegram","whatsapp"], "voice_web":true, "shared_processes":true, "byok_unlimited":true}'::jsonb)
  ) as v(code, caps)
 where public.billing_plans.code = v.code;

-- ---------------------------------------------------------------------------
-- Periodos de uso
-- ---------------------------------------------------------------------------
create table public.workspace_usage_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  source text not null default 'plan' check (source in ('plan', 'grant')),
  plan_code text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  tasks_allowance integer not null check (tasks_allowance >= 0),
  tasks_used numeric(10, 2) not null default 0 check (tasks_used >= 0),
  extra_tasks integer not null default 0 check (extra_tasks >= 0),
  usd_cap numeric(10, 4) not null check (usd_cap >= 0),
  usd_used numeric(12, 6) not null default 0 check (usd_used >= 0),
  warned_80_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (workspace_id, period_start)
);

create index workspace_usage_periods_current_idx
  on public.workspace_usage_periods (workspace_id, period_end desc);

comment on table public.workspace_usage_periods is
  'Cupo de tareas y tope en USD de la IA incluida, por espacio y periodo. Solo escribe service_role.';

alter table public.workspace_usage_periods enable row level security;

create policy workspace_usage_periods_select_member
  on public.workspace_usage_periods for select to authenticated
  using (private.is_member(workspace_id));

revoke all on public.workspace_usage_periods from anon, authenticated;
grant select on public.workspace_usage_periods to authenticated;
grant all on public.workspace_usage_periods to service_role;

-- Periodo vigente con lo que queda. Sin fila: el espacio no tiene IA incluida.
create function public.usage_current(p_workspace_id uuid)
returns table (
  period_id uuid,
  plan_code text,
  period_end timestamptz,
  tasks_allowance integer,
  tasks_used numeric,
  tasks_left numeric,
  usd_cap numeric,
  usd_used numeric,
  usd_left numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.plan_code, p.period_end, p.tasks_allowance + p.extra_tasks, p.tasks_used,
         greatest(p.tasks_allowance + p.extra_tasks - p.tasks_used, 0),
         p.usd_cap, p.usd_used, greatest(p.usd_cap - p.usd_used, 0)
    from public.workspace_usage_periods p
   where p.workspace_id = p_workspace_id
     and p.period_start <= now() and p.period_end > now()
   order by p.period_start desc
   limit 1;
$$;

-- Apunta tareas y gasto en el periodo vigente. Siempre suma (aunque se pase),
-- como trial_add_cost. Devuelve false si no hay periodo vigente.
create function public.usage_consume(p_workspace_id uuid, p_kind text, p_units numeric, p_cost_usd numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_allowance integer;
  v_used numeric;
begin
  if p_kind not in ('run', 'run_max_quality', 'reply', 'inbox_classify', 'other') then
    raise exception 'usage_consume: tipo desconocido %', p_kind using errcode = '22023';
  end if;
  update public.workspace_usage_periods p
     set tasks_used = p.tasks_used + greatest(coalesce(p_units, 0), 0),
         usd_used = p.usd_used + greatest(coalesce(p_cost_usd, 0), 0),
         updated_at = now()
   where p.id = (
           select c.id from public.workspace_usage_periods c
            where c.workspace_id = p_workspace_id
              and c.period_start <= now() and c.period_end > now()
            order by c.period_start desc
            limit 1
         )
  returning p.id, p.tasks_allowance + p.extra_tasks, p.tasks_used into v_id, v_allowance, v_used;
  if v_id is null then
    return false;
  end if;
  -- Marcas para los avisos del 80 % y del 100 % (los avisos llegan en la fase P2).
  update public.workspace_usage_periods
     set warned_80_at = coalesce(warned_80_at, case when v_used >= v_allowance * 0.8 then now() end),
         paused_at = coalesce(paused_at, case when v_used >= v_allowance or usd_used >= usd_cap then now() end)
   where id = v_id;
  return true;
end;
$$;

-- Abre (o devuelve) el periodo de un espacio con los cupos de un plan.
-- Lo usarán el webhook de cobro (fase P3) y las concesiones manuales.
create function public.usage_open_period(
  p_workspace_id uuid,
  p_plan_code text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_subscription_id uuid default null,
  p_source text default 'plan'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caps jsonb;
  v_id uuid;
begin
  select capabilities into v_caps from public.billing_plans where code = p_plan_code;
  if v_caps is null or not (v_caps ? 'monthly_tasks') then
    raise exception 'usage_open_period: plan sin cupo %', p_plan_code using errcode = '22023';
  end if;
  insert into public.workspace_usage_periods
    (workspace_id, subscription_id, source, plan_code, period_start, period_end, tasks_allowance, usd_cap)
  values
    (p_workspace_id, p_subscription_id, p_source, p_plan_code, p_period_start, p_period_end,
     (v_caps ->> 'monthly_tasks')::integer, (v_caps ->> 'period_usd_cap')::numeric)
  on conflict (workspace_id, period_start) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.workspace_usage_periods
     where workspace_id = p_workspace_id and period_start = p_period_start;
  end if;
  return v_id;
end;
$$;

-- Abre el periodo vigente de cada suscripción activa que aún no lo tenga.
-- Pensado para un cron diario cuando haya cobro (fase P3); hoy no hay suscripciones.
create function public.usage_period_roll()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select s.id, s.workspace_id, p.code, s.current_period_start, s.current_period_end
      from public.subscriptions s
      join public.billing_plans p on p.id = s.plan_id
     where s.status in ('active', 'trialing', 'cancel_at_period_end')
       and s.current_period_start is not null and s.current_period_end > now()
       and not exists (
         select 1 from public.workspace_usage_periods u
          where u.workspace_id = s.workspace_id and u.period_start = s.current_period_start
       )
  loop
    perform public.usage_open_period(r.workspace_id, r.code, r.current_period_start, r.current_period_end, r.id, 'plan');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.usage_current(uuid) from public, anon, authenticated;
revoke all on function public.usage_consume(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.usage_open_period(uuid, text, timestamptz, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.usage_period_roll() from public, anon, authenticated;
grant execute on function public.usage_current(uuid) to service_role;
grant execute on function public.usage_consume(uuid, text, numeric, numeric) to service_role;
grant execute on function public.usage_open_period(uuid, text, timestamptz, timestamptz, uuid, text) to service_role;
grant execute on function public.usage_period_roll() to service_role;

-- ---------------------------------------------------------------------------
-- La prueba: 14 días o 1 USD, lo que llegue antes
-- ---------------------------------------------------------------------------
alter table public.workspace_trial_credits
  add column if not exists expires_at timestamptz;

update public.workspace_trial_credits
   set expires_at = now() + interval '14 days'
 where expires_at is null;

alter table public.workspace_trial_credits
  alter column expires_at set default (now() + interval '14 days'),
  alter column expires_at set not null;

comment on column public.workspace_trial_credits.expires_at is
  'Fin de la prueba gratuita (14 días). Pasada la fecha, el saldo en USD ya no se usa.';

-- La bandeja se ordena con la IA propia, con la prueba vigente o con la IA incluida.
create or replace function public.inbox_workspaces_pending(p_limit int)
returns table (workspace_id uuid, pending bigint)
language sql
security definer
set search_path = ''
as $$
  select t.workspace_id, count(*) as pending
  from public.inbox_threads t
  where t.message_count > t.classified_count and not t.archived
    and (
      exists (select 1 from public.ai_connections a where a.workspace_id = t.workspace_id and a.status = 'active')
      or exists (
        select 1 from public.workspace_trial_credits c
         where c.workspace_id = t.workspace_id and c.used_usd < c.allowance_usd and c.expires_at > now()
      )
      or exists (
        select 1 from public.workspace_usage_periods p
         where p.workspace_id = t.workspace_id
           and p.period_start <= now() and p.period_end > now()
           and p.usd_used < p.usd_cap
      )
    )
  group by t.workspace_id
  order by min(t.updated_at)
  limit greatest(1, least(p_limit, 20));
$$;
revoke all on function public.inbox_workspaces_pending(int) from public, anon, authenticated;
grant execute on function public.inbox_workspaces_pending(int) to service_role;
