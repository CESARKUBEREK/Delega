-- =============================================================================
-- Delega · Migración 2 · Conexión de IA (BYOK), asistente, flujos y consumo
-- -----------------------------------------------------------------------------
-- Crea: ai_connections (la clave del cliente vive en Vault, nunca en la tabla),
--       conversations, messages, flows, usage_events; funciones solo para
--       service_role (Edge Functions) que guardan/leen/borran la clave en Vault.
--
-- Principios:
--   * Todo lleva workspace_id y RLS. Las claves foráneas compuestas
--     (id, workspace_id) impiden enlazar filas de espacios distintos.
--   * El navegador nunca recibe la clave: la columna vault_secret_id no se
--     concede a authenticated y el descifrado solo lo hace service_role.
--   * Los mensajes, el consumo y las conexiones solo los escriben las Edge
--     Functions (service_role), después de comprobar la membresía.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Conexiones de proveedores de IA (una por proveedor y espacio)
-- -----------------------------------------------------------------------------
create table public.ai_connections (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  provider          text not null check (provider in ('openai')),
  model             text not null check (char_length(model) between 1 and 80),
  key_hint          text not null check (char_length(key_hint) <= 12),
  vault_secret_id   uuid not null,
  status            text not null default 'active' check (status in ('active', 'invalid')),
  last_validated_at timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (workspace_id, provider)
);
comment on table public.ai_connections is 'Conexión BYOK por espacio y proveedor. La clave está cifrada en Vault (vault_secret_id); aquí solo hay una pista de 4 caracteres.';

-- -----------------------------------------------------------------------------
-- 2. Conversaciones con el asistente y sus mensajes
-- -----------------------------------------------------------------------------
create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,
  title         text not null check (char_length(title) between 1 and 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id)
);
create index conversations_workspace_idx on public.conversations (workspace_id, updated_at desc);
create index conversations_created_by_idx on public.conversations (created_by);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null,
  workspace_id     uuid not null,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null check (char_length(content) <= 20000),
  plan             jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 65536)),
  model            text check (model is null or char_length(model) <= 80),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (conversation_id, workspace_id)
    references public.conversations (id, workspace_id) on delete cascade
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_workspace_idx on public.messages (workspace_id);
create index messages_created_by_idx on public.messages (created_by, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Automatizaciones (flujos). Formato interno: definition (ver README)
-- -----------------------------------------------------------------------------
create table public.flows (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 120),
  summary            text not null default '' check (char_length(summary) <= 2000),
  definition         jsonb not null check (jsonb_typeof(definition) = 'object' and pg_column_size(definition) <= 65536),
  status             text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  version            int not null default 1 check (version >= 1),
  source_message_id  bigint,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- El mensaje de origen tiene que ser del mismo espacio.
  foreign key (source_message_id, workspace_id)
    references public.messages (id, workspace_id) on delete set null (source_message_id)
);
create index flows_workspace_idx on public.flows (workspace_id, updated_at desc);
create index flows_created_by_idx on public.flows (created_by);
create index flows_source_message_idx on public.flows (source_message_id);

-- -----------------------------------------------------------------------------
-- 4. Consumo de IA por espacio
-- -----------------------------------------------------------------------------
create table public.usage_events (
  id               bigint generated always as identity primary key,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  provider         text not null,
  model            text not null,
  input_tokens     int not null default 0 check (input_tokens >= 0),
  output_tokens    int not null default 0 check (output_tokens >= 0),
  conversation_id  uuid,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (conversation_id, workspace_id)
    references public.conversations (id, workspace_id) on delete set null (conversation_id)
);
create index usage_events_workspace_idx on public.usage_events (workspace_id, created_at desc);
create index usage_events_conversation_idx on public.usage_events (conversation_id);
create index usage_events_created_by_idx on public.usage_events (created_by);

-- -----------------------------------------------------------------------------
-- 5. updated_at
-- -----------------------------------------------------------------------------
create trigger ai_connections_set_updated_at before update on public.ai_connections for each row execute function private.set_updated_at();
create trigger conversations_set_updated_at  before update on public.conversations  for each row execute function private.set_updated_at();
create trigger flows_set_updated_at          before update on public.flows          for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Funciones de Vault (solo service_role, es decir, Edge Functions)
-- -----------------------------------------------------------------------------

-- Guarda o sustituye la clave del proveedor para un espacio.
create function public.ai_connection_save(
  p_workspace_id uuid,
  p_provider text,
  p_api_key text,
  p_model text,
  p_actor uuid
)
returns table (connection_id uuid, key_hint text, model text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.ai_connections%rowtype;
  v_secret   uuid;
  v_hint     text := '…' || right(p_api_key, 4);
  v_id       uuid;
begin
  if p_api_key is null or char_length(p_api_key) not between 20 and 400 then
    raise exception 'Clave no válida' using errcode = '22023';
  end if;

  select * into v_existing from public.ai_connections c
  where c.workspace_id = p_workspace_id and c.provider = p_provider
  for update;

  if v_existing.id is null then
    v_secret := vault.create_secret(
      p_api_key,
      'ai:' || p_workspace_id::text || ':' || p_provider || ':' || gen_random_uuid()::text,
      'Clave BYOK de ' || p_provider || ' del espacio ' || p_workspace_id::text);
    insert into public.ai_connections (workspace_id, provider, model, key_hint, vault_secret_id, status, created_by)
    values (p_workspace_id, p_provider, p_model, v_hint, v_secret, 'active', p_actor)
    returning id into v_id;
  else
    perform vault.update_secret(v_existing.vault_secret_id, p_api_key);
    update public.ai_connections
    set model = p_model, key_hint = v_hint, status = 'active', last_validated_at = now()
    where id = v_existing.id;
    v_id := v_existing.id;
  end if;

  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, p_actor, 'ai_connection.saved', 'ai_connection', v_id::text,
          jsonb_build_object('provider', p_provider, 'model', p_model));

  return query select v_id, v_hint, p_model;
end;
$$;

-- Devuelve la clave descifrada. Solo la usa la Edge Function del asistente.
create function public.ai_connection_secret(p_workspace_id uuid, p_provider text)
returns table (api_key text, model text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret, c.model, c.status
  from public.ai_connections c
  join vault.decrypted_secrets ds on ds.id = c.vault_secret_id
  where c.workspace_id = p_workspace_id and c.provider = p_provider;
$$;

-- Borra la conexión y su secreto en Vault.
create function public.ai_connection_delete(p_workspace_id uuid, p_provider text, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conn public.ai_connections%rowtype;
begin
  select * into v_conn from public.ai_connections c
  where c.workspace_id = p_workspace_id and c.provider = p_provider
  for update;
  if v_conn.id is null then
    return false;
  end if;

  delete from public.ai_connections where id = v_conn.id;
  delete from vault.secrets where id = v_conn.vault_secret_id;

  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, p_actor, 'ai_connection.deleted', 'ai_connection', v_conn.id::text,
          jsonb_build_object('provider', p_provider));
  return true;
end;
$$;

-- Marca la conexión como inválida (p. ej. el proveedor rechazó la clave).
create function public.ai_connection_mark_invalid(p_workspace_id uuid, p_provider text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_connections set status = 'invalid'
  where workspace_id = p_workspace_id and provider = p_provider;
$$;

revoke all on function public.ai_connection_save(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_connection_secret(uuid, text)                   from public, anon, authenticated;
revoke all on function public.ai_connection_delete(uuid, text, uuid)             from public, anon, authenticated;
revoke all on function public.ai_connection_mark_invalid(uuid, text)             from public, anon, authenticated;
grant execute on function public.ai_connection_save(uuid, text, text, text, uuid) to service_role;
grant execute on function public.ai_connection_secret(uuid, text)                 to service_role;
grant execute on function public.ai_connection_delete(uuid, text, uuid)           to service_role;
grant execute on function public.ai_connection_mark_invalid(uuid, text)           to service_role;

-- Si se borra la conexión en cascada (al borrar el espacio), también se borra
-- su secreto: ninguna clave queda huérfana en Vault.
create function private.ai_connection_cleanup_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$$;
revoke all on function private.ai_connection_cleanup_secret() from public, anon, authenticated;

create trigger ai_connections_cleanup_secret
  after delete on public.ai_connections
  for each row execute function private.ai_connection_cleanup_secret();

-- -----------------------------------------------------------------------------
-- 7. Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.ai_connections, public.conversations, public.messages,
                    public.flows, public.usage_events
  from anon, authenticated;

-- ai_connections: los miembros ven el estado; nunca vault_secret_id.
grant select (id, workspace_id, provider, model, key_hint, status, last_validated_at,
              created_by, created_at, updated_at)
  on public.ai_connections to authenticated;

grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;

grant select, insert, delete on public.flows to authenticated;
grant update (name, summary, definition, status) on public.flows to authenticated;

grant select on public.usage_events to authenticated;

alter table public.ai_connections enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.flows          enable row level security;
alter table public.usage_events   enable row level security;

create policy ai_connections_select_member on public.ai_connections
  for select to authenticated
  using (private.is_member(workspace_id));

-- Conversaciones: las ve quien las creó y los admins/owners del espacio.
create policy conversations_select on public.conversations
  for select to authenticated
  using (private.is_member(workspace_id)
         and (created_by = (select auth.uid()) or private.has_role(workspace_id, 'admin')));

create policy messages_select on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.workspace_id = messages.workspace_id
      and private.is_member(c.workspace_id)
      and (c.created_by = (select auth.uid()) or private.has_role(c.workspace_id, 'admin'))
  ));

-- Flujos: todos los miembros los ven y crean; editan/borran autor o admins.
create policy flows_select_member on public.flows
  for select to authenticated
  using (private.is_member(workspace_id));

create policy flows_insert_member on public.flows
  for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()) and status = 'draft');

create policy flows_update_author_or_admin on public.flows
  for update to authenticated
  using (private.is_member(workspace_id)
         and (created_by = (select auth.uid()) or private.has_role(workspace_id, 'admin')))
  with check (private.is_member(workspace_id));

create policy flows_delete_author_or_admin on public.flows
  for delete to authenticated
  using (private.is_member(workspace_id)
         and (created_by = (select auth.uid()) or private.has_role(workspace_id, 'admin')));

-- Consumo: cada uno ve el suyo; admins/owners ven el de todo el espacio.
create policy usage_events_select on public.usage_events
  for select to authenticated
  using (private.is_member(workspace_id)
         and (created_by = (select auth.uid()) or private.has_role(workspace_id, 'admin')));
