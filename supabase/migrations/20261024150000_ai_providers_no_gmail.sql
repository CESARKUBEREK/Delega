-- =============================================================================
-- Orkesta · Migración 8 · Varias IAs (OpenAI, Anthropic, DeepSeek) y sin Gmail
-- -----------------------------------------------------------------------------
-- * ai_connections admite 'anthropic' y 'deepseek', además de 'openai'.
--   Cada espacio tiene una conexión principal (is_default); una automatización
--   puede usar otra guardando su modelo en flows.settings.model.
-- * Se retira la integración de Gmail por OAuth: Gmail se conecta ahora como
--   correo IMAP/SMTP. Se borran sus conexiones (y su token en Vault, mediante
--   el trigger de limpieza); las conversaciones ya guardadas se conservan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Proveedores de IA
-- -----------------------------------------------------------------------------
alter table public.ai_connections drop constraint ai_connections_provider_check;
alter table public.ai_connections
  add constraint ai_connections_provider_check check (provider in ('openai', 'anthropic', 'deepseek'));

alter table public.ai_connections add column is_default boolean not null default false;
-- Las conexiones que ya existen (solo OpenAI) pasan a ser la principal de su espacio.
update public.ai_connections set is_default = true where provider = 'openai';
create unique index ai_connections_one_default_idx on public.ai_connections (workspace_id) where is_default;
grant select (is_default) on public.ai_connections to authenticated;

-- La primera conexión de un espacio es la principal; si se borra la principal,
-- pasa a serlo otra (la más antigua).
create function private.ai_connection_default_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.ai_connections c where c.workspace_id = new.workspace_id and c.is_default and c.id <> new.id) then
    new.is_default := true;
  else
    new.is_default := false;
  end if;
  return new;
end;
$$;
create trigger ai_connections_default_on_insert
  before insert on public.ai_connections
  for each row execute function private.ai_connection_default_on_insert();

create function private.ai_connection_default_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.ai_connections set is_default = true
    where id = (select c.id from public.ai_connections c where c.workspace_id = old.workspace_id order by c.created_at limit 1);
  end if;
  return null;
end;
$$;
create trigger ai_connections_default_on_delete
  after delete on public.ai_connections
  for each row execute function private.ai_connection_default_on_delete();

revoke all on function private.ai_connection_default_on_insert() from public, anon, authenticated;
revoke all on function private.ai_connection_default_on_delete() from public, anon, authenticated;

-- Cambiar la principal (solo service_role, tras comprobar que es admin).
create function public.ai_connection_set_default(p_workspace_id uuid, p_provider text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.ai_connections c where c.workspace_id = p_workspace_id and c.provider = p_provider) then
    return false;
  end if;
  update public.ai_connections set is_default = false where workspace_id = p_workspace_id and is_default and provider <> p_provider;
  update public.ai_connections set is_default = true where workspace_id = p_workspace_id and provider = p_provider;
  return true;
end;
$$;
revoke all on function public.ai_connection_set_default(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_connection_set_default(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- 2. Sin Gmail por OAuth
-- -----------------------------------------------------------------------------
delete from public.integrations where provider = 'gmail';
delete from public.oauth_states where provider = 'gmail';

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap'));

alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check check (provider in ('google', 'calendar'));

create or replace function public.mail_integrations_due(p_limit int default 20)
returns table (workspace_id uuid, provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.workspace_id, i.provider
  from public.integrations i
  where i.provider = 'imap' and i.status = 'active'
  order by coalesce((i.config ->> 'last_sync_at')::timestamptz, 'epoch'::timestamptz)
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
