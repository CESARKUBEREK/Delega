-- =============================================================================
-- Orkesta · Varios proveedores de IA (LLMs)
--
-- Cambia:
--   ai_connections  admite anthropic, deepseek y kimi además de openai, y marca
--                   un proveedor «por defecto» por espacio (el que usan el
--                   asistente, la bandeja y las automatizaciones).
--   flow_runs       guarda el proveedor de cada ejecución: una ejecución sigue
--                   con el mismo proveedor aunque luego cambie el de por defecto.
-- Crea:
--   ai_connection_set_default(ws, provider, actor)  (solo service_role)
--   ai_connection_ensure_default(ws)                (solo service_role)
-- =============================================================================

alter table public.ai_connections drop constraint ai_connections_provider_check;
alter table public.ai_connections add constraint ai_connections_provider_check
  check (provider in ('openai', 'anthropic', 'deepseek', 'kimi'));

alter table public.ai_connections add column is_default boolean not null default false;
create unique index ai_connections_one_default on public.ai_connections (workspace_id) where is_default;
comment on column public.ai_connections.is_default is 'Proveedor que usa el espacio. Como mucho uno por espacio.';

-- Hasta ahora solo existía OpenAI: pasa a ser el de por defecto.
update public.ai_connections set is_default = true where provider = 'openai';

grant select (is_default) on public.ai_connections to authenticated;

alter table public.flow_runs add column provider text not null default 'openai'
  check (provider in ('openai', 'anthropic', 'deepseek', 'kimi'));
grant select (provider) on public.flow_runs to authenticated;

-- -----------------------------------------------------------------------------
-- Elegir el proveedor por defecto
-- -----------------------------------------------------------------------------
create function public.ai_connection_set_default(p_workspace_id uuid, p_provider text, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.ai_connections c
  where c.workspace_id = p_workspace_id and c.provider = p_provider
  for update;
  if v_id is null then
    return false;
  end if;

  update public.ai_connections set is_default = false
  where workspace_id = p_workspace_id and is_default and id <> v_id;
  update public.ai_connections set is_default = true where id = v_id;

  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, p_actor, 'ai_connection.default', 'ai_connection', v_id::text,
          jsonb_build_object('provider', p_provider));
  return true;
end;
$$;

-- Si el espacio no tiene proveedor por defecto (primera conexión, o se borró
-- el que lo era), elige la conexión activa más reciente.
create function public.ai_connection_ensure_default(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_default:' || p_workspace_id::text, 0));

  select c.provider into v_provider from public.ai_connections c
  where c.workspace_id = p_workspace_id and c.is_default;
  if v_provider is not null then
    return v_provider;
  end if;

  select c.provider into v_provider from public.ai_connections c
  where c.workspace_id = p_workspace_id
  order by (c.status = 'active') desc, c.updated_at desc
  limit 1;
  if v_provider is not null then
    update public.ai_connections set is_default = true
    where workspace_id = p_workspace_id and provider = v_provider;
  end if;
  return v_provider;
end;
$$;

revoke all on function public.ai_connection_set_default(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_connection_ensure_default(uuid)         from public, anon, authenticated;
grant execute on function public.ai_connection_set_default(uuid, text, uuid) to service_role;
grant execute on function public.ai_connection_ensure_default(uuid)         to service_role;
