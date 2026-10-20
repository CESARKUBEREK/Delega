-- =============================================================================
-- Delega · Migración 4 · Google Docs, WhatsApp y disparadores por mensaje
-- -----------------------------------------------------------------------------
-- * integrations admite el proveedor 'whatsapp' y guarda configuración no
--   secreta en `config` (ID del número, número visible). Las credenciales
--   (token de acceso, secreto de la app, token de verificación) van juntas
--   como JSON en Vault, igual que el refresh token de Google.
-- * contacts: destinatarios autorizados por espacio. Un flujo solo puede
--   escribir por WhatsApp a estos contactos o a quien acaba de escribir.
-- * whatsapp_messages: registro de mensajes entrantes y salientes.
-- * flow_runs.trigger: qué lanzó la ejecución (manual o un mensaje).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Integraciones: WhatsApp y configuración pública
-- -----------------------------------------------------------------------------
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check check (provider in ('google', 'whatsapp'));
alter table public.integrations
  add column config jsonb not null default '{}'::jsonb
  check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 8192);

grant select (config) on public.integrations to authenticated;

-- Configuración no secreta (solo service_role).
create function public.integration_set_config(p_workspace_id uuid, p_provider text, p_config jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.integrations set config = coalesce(p_config, '{}'::jsonb)
  where workspace_id = p_workspace_id and provider = p_provider;
$$;
revoke all on function public.integration_set_config(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.integration_set_config(uuid, text, jsonb) to service_role;

-- Localiza una integración de WhatsApp por su ID (lo usa el webhook, que no
-- tiene sesión de usuario). Devuelve también el secreto descifrado.
create function public.integration_secret_by_id(p_integration_id uuid)
returns table (workspace_id uuid, provider text, secret text, status text, config jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select i.workspace_id, i.provider, ds.decrypted_secret, i.status, i.config
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.id = p_integration_id;
$$;
revoke all on function public.integration_secret_by_id(uuid) from public, anon, authenticated;
grant execute on function public.integration_secret_by_id(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 2. Contactos autorizados
-- -----------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  phone         text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (workspace_id, phone),
  unique (id, workspace_id)
);
create index contacts_created_by_idx on public.contacts (created_by);

-- -----------------------------------------------------------------------------
-- 3. Mensajes de WhatsApp
-- -----------------------------------------------------------------------------
create table public.whatsapp_messages (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  integration_id  uuid,
  direction       text not null check (direction in ('in', 'out')),
  phone           text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  contact_name    text check (contact_name is null or char_length(contact_name) <= 200),
  body            text not null default '' check (char_length(body) <= 4096),
  message_type    text not null default 'text' check (char_length(message_type) <= 40),
  wa_message_id   text unique check (wa_message_id is null or char_length(wa_message_id) <= 200),
  status          text check (status is null or char_length(status) <= 40),
  run_id          uuid,
  created_at      timestamptz not null default now(),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete set null (integration_id),
  foreign key (run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete set null (run_id)
);
create index whatsapp_messages_workspace_idx on public.whatsapp_messages (workspace_id, created_at desc);
create index whatsapp_messages_integration_ws_idx on public.whatsapp_messages (integration_id, workspace_id);
create index whatsapp_messages_run_ws_idx on public.whatsapp_messages (run_id, workspace_id);
create index whatsapp_messages_phone_idx on public.whatsapp_messages (workspace_id, phone, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. Qué lanzó cada ejecución
-- -----------------------------------------------------------------------------
alter table public.flow_runs
  add column trigger jsonb not null default '{"type": "manual"}'::jsonb
  check (jsonb_typeof(trigger) = 'object' and pg_column_size(trigger) <= 8192);
grant select (trigger) on public.flow_runs to authenticated;

-- Ajustes de cada flujo para ejecuciones automáticas (archivos que usa).
alter table public.flows
  add column settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192);
grant update (settings) on public.flows to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.contacts, public.whatsapp_messages from anon, authenticated;

grant select on public.contacts to authenticated;
grant insert (workspace_id, name, phone, created_by) on public.contacts to authenticated;
grant update (name) on public.contacts to authenticated;
grant delete on public.contacts to authenticated;

grant select on public.whatsapp_messages to authenticated;

alter table public.contacts          enable row level security;
alter table public.whatsapp_messages enable row level security;

-- Contactos: los ven los miembros; los gestionan admins y owners.
create policy contacts_select_member on public.contacts
  for select to authenticated
  using (private.is_member(workspace_id));

create policy contacts_insert_admin on public.contacts
  for insert to authenticated
  with check (private.has_role(workspace_id, 'admin') and created_by = (select auth.uid()));

create policy contacts_update_admin on public.contacts
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));

create policy contacts_delete_admin on public.contacts
  for delete to authenticated
  using (private.has_role(workspace_id, 'admin'));

-- Mensajes: solo admins y owners (pueden contener datos de clientes).
create policy whatsapp_messages_select_admin on public.whatsapp_messages
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));
