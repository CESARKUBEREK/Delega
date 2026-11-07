-- Prueba gratuita hasta 1 USD de gasto (decisión de Cesar, 7 nov).
-- Sustituye el cupo de «1 ejecución»: cada espacio con fila de créditos puede
-- ejecutar automatizaciones con la IA de MarchaSolo (manuales, programadas o
-- por disparador) hasta gastar allowance_usd. Los planes del onboarding siguen
-- con su propio cupo (allowance_plans, máx. 2).
-- used_runs se sigue contando, solo como métrica.

alter table public.workspace_trial_credits
  add column if not exists allowance_usd numeric(10,4) not null default 1.00 check (allowance_usd >= 0),
  add column if not exists used_usd numeric(10,4) not null default 0 check (used_usd >= 0);

comment on column public.workspace_trial_credits.allowance_usd is
  'Gasto máximo (USD) de ejecuciones financiadas por MarchaSolo.';
comment on column public.workspace_trial_credits.used_usd is
  'Gasto (USD) ya consumido en ejecuciones financiadas por MarchaSolo.';

-- Lo ya gastado en ejecuciones gratuitas cuenta.
update public.workspace_trial_credits t
   set used_usd = coalesce((
         select sum(r.cost_usd)
           from public.flow_runs r
          where r.workspace_id = t.workspace_id
            and r.routing ->> 'trial' = 'true'
       ), 0),
       reserved_run_id = null,
       updated_at = now();

-- Reserva: hay saldo y la ejecución es del espacio. Ya no hay una sola
-- ejecución a la vez; el gasto lo controla trial_add_cost en cada llamada.
create or replace function public.trial_run_consume(p_workspace_id uuid, p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.workspace_trial_credits t
     set used_runs = used_runs + 1,
         updated_at = now()
   where t.workspace_id = p_workspace_id
     and t.used_usd < t.allowance_usd
     and exists (
       select 1 from public.flow_runs r
        where r.id = p_run_id and r.workspace_id = p_workspace_id
     );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Se mantienen por compatibilidad con el agente: ya no hay reserva que
-- confirmar; liberar solo descuenta la métrica de ejecuciones.
create or replace function public.trial_run_commit(p_workspace_id uuid, p_run_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.flow_runs r
     where r.id = p_run_id and r.workspace_id = p_workspace_id
  );
$$;

create or replace function public.trial_run_release(p_workspace_id uuid, p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.workspace_trial_credits
     set used_runs = greatest(used_runs - 1, 0),
         updated_at = now()
   where workspace_id = p_workspace_id
     and exists (
       select 1 from public.flow_runs r
        where r.id = p_run_id and r.workspace_id = p_workspace_id
     );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Apunta el coste de cada llamada de una ejecución gratuita. Devuelve lo que
-- queda (0 si se ha pasado). Siempre suma, aunque supere el máximo.
create or replace function public.trial_add_cost(p_workspace_id uuid, p_cost numeric)
returns numeric
language sql
security definer
set search_path = ''
as $$
  update public.workspace_trial_credits
     set used_usd = used_usd + greatest(coalesce(p_cost, 0), 0),
         updated_at = now()
   where workspace_id = p_workspace_id
  returning greatest(allowance_usd - used_usd, 0);
$$;

revoke all on function public.trial_run_consume(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trial_run_commit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trial_run_release(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trial_add_cost(uuid, numeric) from public, anon, authenticated;
grant execute on function public.trial_run_consume(uuid, uuid) to service_role;
grant execute on function public.trial_run_commit(uuid, uuid) to service_role;
grant execute on function public.trial_run_release(uuid, uuid) to service_role;
grant execute on function public.trial_add_cost(uuid, numeric) to service_role;
