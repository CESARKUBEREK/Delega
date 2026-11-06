-- El cupo de ejecución gratuita se concede por fila de créditos, no por tipo
-- de workspace. Así se pueden habilitar organizaciones de forma explícita
-- sin regalar ejecuciones a espacios que no tengan una concesión.
-- La reserva también exige tokens disponibles para limitar el coste total.
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
     and t.used_runs < t.allowance_runs
     and t.used_tokens < t.allowance_tokens
     and t.reserved_run_id is null
     and exists (
       select 1 from public.flow_runs r
        where r.id = p_run_id and r.workspace_id = p_workspace_id
     );
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.trial_run_consume(uuid, uuid) is
  'Reserva una ejecución gratuita solo si el workspace tiene una concesión explícita de créditos y tokens disponibles.';

revoke all on function public.trial_run_consume(uuid, uuid) from public, anon, authenticated;
grant execute on function public.trial_run_consume(uuid, uuid) to service_role;
