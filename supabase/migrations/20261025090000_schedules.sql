-- =============================================================================
-- Orkesta · Migración 10 · Ejecuciones programadas
-- -----------------------------------------------------------------------------
-- * Las automatizaciones con disparador "schedule" guardan su programación en
--   flows.settings.schedule:
--     { frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly',
--       time: 'HH:MM', weekday: 1-7 (ISO, 1 = lunes), day_of_month: 1-28 o 0 (último) }
-- * flows.next_run_at la calcula un trigger (nunca el navegador), en la hora
--   local del espacio (la de Google Calendar o, si no hay, Europe/Madrid).
-- * runs-cron llama a flows_due() cada minuto: toma las que tocan, avanza su
--   próxima ejecución en la misma operación y dice si hay que lanzarlas
--   (no se lanzan las que se perdieron hace más de 6 horas).
-- =============================================================================

alter table public.flows add column next_run_at timestamptz;
create index flows_next_run_idx on public.flows (next_run_at) where status = 'active' and next_run_at is not null;

-- Zona horaria del espacio.
create function private.workspace_timezone(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(i.config ->> 'timezone', '')
     from public.integrations i
     where i.workspace_id = p_workspace_id and i.provider = 'calendar'
       and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = i.config ->> 'timezone')),
    'Europe/Madrid');
$$;

-- Próxima ejecución estrictamente posterior a p_after, o null si la
-- programación no es válida.
create function private.flow_next_run(p_schedule jsonb, p_tz text, p_after timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_freq text := p_schedule ->> 'frequency';
  v_time text := p_schedule ->> 'time';
  v_weekday int;
  v_dom int;
  v_day date;
  v_at timestamptz;
  v_ok boolean;
begin
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object'
     or v_freq is null or v_freq not in ('daily', 'weekdays', 'weekly', 'monthly')
     or v_time is null or v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return null;
  end if;
  if v_freq = 'weekly' then
    v_weekday := case when (p_schedule ->> 'weekday') ~ '^[1-7]$' then (p_schedule ->> 'weekday')::int end;
    if v_weekday is null then return null; end if;
  end if;
  if v_freq = 'monthly' then
    v_dom := case when (p_schedule ->> 'day_of_month') ~ '^([0-9]|1[0-9]|2[0-8])$' then (p_schedule ->> 'day_of_month')::int end;
    if v_dom is null then return null; end if;
  end if;

  v_day := (p_after at time zone p_tz)::date;
  for i in 0..62 loop
    v_ok := case v_freq
      when 'daily' then true
      when 'weekdays' then extract(isodow from v_day) <= 5
      when 'weekly' then extract(isodow from v_day) = v_weekday
      else (v_dom = 0 and extract(day from v_day + 1) = 1) or (v_dom > 0 and extract(day from v_day) = v_dom)
    end;
    if v_ok then
      -- Hora local del espacio, también en los días de cambio de hora.
      v_at := (v_day + v_time::time) at time zone p_tz;
      if v_at > p_after then
        return v_at;
      end if;
    end if;
    v_day := v_day + 1;
  end loop;
  return null;
end;
$$;

-- Calcula next_run_at al crear, activar, pausar o cambiar la programación. Si
-- solo cambia next_run_at (flows_due), se respeta.
create function private.flows_set_next_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.settings is not distinct from old.settings
     and new.definition is not distinct from old.definition then
    return new;
  end if;
  if new.status = 'active' and new.definition -> 'trigger' ->> 'type' = 'schedule' then
    new.next_run_at := private.flow_next_run(new.settings -> 'schedule', private.workspace_timezone(new.workspace_id), now());
  else
    new.next_run_at := null;
  end if;
  return new;
end;
$$;
create trigger flows_set_next_run
  before insert or update on public.flows
  for each row execute function private.flows_set_next_run();

revoke all on function private.workspace_timezone(uuid) from public, anon, authenticated;
revoke all on function private.flow_next_run(jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function private.flows_set_next_run() from public, anon, authenticated;

-- Automatizaciones programadas que tocan. Cada una se toma una sola vez
-- (for update skip locked) y su próxima ejecución avanza en la misma
-- transacción. launch = false si se perdió hace más de 6 horas.
create function public.flows_due(p_limit int default 10)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  definition jsonb,
  settings jsonb,
  created_by uuid,
  scheduled_for timestamptz,
  launch boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select f.id, f.workspace_id, f.name, f.definition, f.settings, f.created_by, f.next_run_at
    from public.flows f
    where f.status = 'active' and f.next_run_at is not null and f.next_run_at <= now()
    order by f.next_run_at
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  loop
    update public.flows f
    set next_run_at = private.flow_next_run(f.settings -> 'schedule', private.workspace_timezone(f.workspace_id), now())
    where f.id = r.id;
    id := r.id;
    workspace_id := r.workspace_id;
    name := r.name;
    definition := r.definition;
    settings := r.settings;
    created_by := r.created_by;
    scheduled_for := r.next_run_at;
    launch := r.next_run_at > now() - interval '6 hours';
    return next;
  end loop;
end;
$$;
revoke all on function public.flows_due(int) from public, anon, authenticated;
grant execute on function public.flows_due(int) to service_role;

-- Ejecuciones programadas recientes de un espacio (límite diario).
create index flow_runs_flow_started_idx on public.flow_runs (flow_id, started_at desc);
