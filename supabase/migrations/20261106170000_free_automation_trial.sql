-- Una única ejecución real gratuita por espacio personal.
-- Separa este cupo del presupuesto de planes del onboarding.
alter table public.workspace_trial_credits
  add column if not exists allowance_runs integer not null default 1 check (allowance_runs >= 0),
  add column if not exists used_runs integer not null default 0 check (used_runs >= 0);

comment on column public.workspace_trial_credits.allowance_runs is
  'Número de ejecuciones reales financiadas por MarchaSolo (separado de los planes de onboarding).';
comment on column public.workspace_trial_credits.used_runs is
  'Ejecuciones gratuitas reservadas por el espacio personal.';

create or replace function public.trial_run_consume(p_workspace_id uuid)
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
     and used_runs < allowance_runs
     and exists (
       select 1 from public.workspaces w
        where w.id = t.workspace_id and w.kind = 'personal'
     );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.trial_run_consume(uuid) from public, anon, authenticated;
grant execute on function public.trial_run_consume(uuid) to service_role;
