-- La bandeja también se ordena con la prueba gratuita (decisión de Cesar, 8 nov).
-- Antes solo entraban en la cola de clasificación los espacios con IA propia;
-- ahora también los que no tienen IA pero les queda saldo de prueba (USD).
-- El costo de clasificar y preparar respuestas se descuenta de ese saldo.
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
         where c.workspace_id = t.workspace_id and c.used_usd < c.allowance_usd
      )
    )
  group by t.workspace_id
  order by min(t.updated_at)
  limit greatest(1, least(p_limit, 20));
$$;
revoke all on function public.inbox_workspaces_pending(int) from public, anon, authenticated;
grant execute on function public.inbox_workspaces_pending(int) to service_role;
