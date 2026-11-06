-- Una única ejecución real gratuita por espacio personal.
-- Separa este cupo del presupuesto de planes del onboarding.
alter table public.workspace_trial_credits
  add column if not exists allowance_runs integer not null default 1 check (allowance_runs >= 0),
  add column if not exists used_runs integer not null default 0 check (used_runs >= 0),
  add column if not exists reserved_run_id uuid references public.flow_runs(id) on delete set null;

comment on column public.workspace_trial_credits.allowance_runs is
  'Número de ejecuciones reales financiadas por MarchaSolo (separado de los planes de onboarding).';
comment on column public.workspace_trial_credits.used_runs is
  'Ejecuciones gratuitas reservadas por el espacio personal.';

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
         reserved_run_id = p_run_id,
         updated_at = now()
   where t.workspace_id = p_workspace_id
     and used_runs < allowance_runs
     and reserved_run_id is null
     and exists (
       select 1 from public.workspaces w
        where w.id = t.workspace_id and w.kind = 'personal'
     )
     and exists (
       select 1 from public.flow_runs r
        where r.id = p_run_id and r.workspace_id = p_workspace_id
     );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
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
         reserved_run_id = null,
         updated_at = now()
   where workspace_id = p_workspace_id and reserved_run_id = p_run_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
create or replace function public.trial_run_commit(p_workspace_id uuid, p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.workspace_trial_credits
     set reserved_run_id = null,
         updated_at = now()
   where workspace_id = p_workspace_id and reserved_run_id = p_run_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.trial_run_consume(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trial_run_release(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trial_run_commit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.trial_run_consume(uuid, uuid) to service_role;
grant execute on function public.trial_run_release(uuid, uuid) to service_role;
grant execute on function public.trial_run_commit(uuid, uuid) to service_role;
