-- =============================================================================
-- Delega · Migración 4 · Gmail, Telegram, bandeja clasificada y disparadores
-- -----------------------------------------------------------------------------
-- * integrations admite 'gmail' (OAuth de Google, refresh token en Vault) y
--   'telegram' (token del bot en Vault) y guarda configuración no secreta en
--   `config` (dirección de correo, usuario del bot, categorías, conservación…).
-- * contacts: direcciones de correo autorizadas. Un flujo solo puede escribir
--   a estos contactos o responder en una conversación existente.
-- * inbox_threads / inbox_messages: conversaciones de correo y de Telegram con
--   la clasificación que propone la IA (categoría, cliente, proyecto, urgencia,
--   si necesita respuesta, resumen), corregible a mano.
-- * flow_runs.trigger y flows.settings: ejecuciones lanzadas por un mensaje de
--   Telegram y archivos que usan.
-- (Google Docs no necesita cambios de esquema: usa integration_files.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Restos de una versión de prueba con WhatsApp (descartada)
-- -----------------------------------------------------------------------------
-- Una versión anterior de esta fase llegó a aplicarse en remoto sin quedar
-- registrada. Sus objetos estaban vacíos; se eliminan para crear todo limpio.
-- En una base nueva estas sentencias no hacen nada.
drop table if exists public.whatsapp_messages;
drop table if exists public.whatsapp_threads;
drop table if exists public.contacts;
drop function if exists public.whatsapp_record_message;
drop function if exists public.whatsapp_purge(uuid, int);
drop function if exists public.integration_set_config(uuid, text, jsonb);
drop function if exists public.integration_secret_by_id(uuid);
alter table public.integrations drop column if exists config;
alter table public.flow_runs drop column if exists trigger;
alter table public.flows drop column if exists settings;

-- -----------------------------------------------------------------------------
-- 1. Integraciones
-- -----------------------------------------------------------------------------
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check check (provider in ('google', 'gmail', 'telegram'));
alter table public.integrations
  add column config jsonb not null default '{}'::jsonb
  check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 8192);
grant select (config) on public.integrations to authenticated;

alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check check (provider in ('google', 'gmail'));

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

-- Integración por ID con su secreto (webhook de Telegram, que no tiene sesión).
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
-- 2. Contactos autorizados (correo)
-- -----------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 320),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (workspace_id, email),
  unique (id, workspace_id)
);
create index contacts_created_by_idx on public.contacts (created_by);

-- -----------------------------------------------------------------------------
-- 3. Conversaciones (hilo de correo o chat de Telegram) y su clasificación
-- -----------------------------------------------------------------------------
create table public.inbox_threads (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  integration_id      uuid,
  channel             text not null check (channel in ('email', 'telegram')),
  external_id         text not null check (char_length(external_id) between 1 and 200),
  subject             text check (subject is null or char_length(subject) <= 300),
  contact_name        text check (contact_name is null or char_length(contact_name) <= 200),
  contact_address     text check (contact_address is null or char_length(contact_address) <= 320),
  last_message_at     timestamptz,
  message_count       int not null default 0 check (message_count >= 0),
  -- Clasificación (la propone la IA; un administrador puede corregirla).
  category            text check (category is null or char_length(category) <= 60),
  client              text check (client is null or char_length(client) <= 120),
  project             text check (project is null or char_length(project) <= 120),
  urgency             text check (urgency is null or urgency in ('alta', 'media', 'baja')),
  needs_reply         boolean,
  summary             text check (summary is null or char_length(summary) <= 1000),
  classified_at       timestamptz,
  classified_count    int not null default 0 check (classified_count >= 0),
  manually_edited     boolean not null default false,
  archived            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, channel, external_id),
  unique (id, workspace_id),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete set null (integration_id)
);
create index inbox_threads_workspace_idx on public.inbox_threads (workspace_id, last_message_at desc nulls last);
create index inbox_threads_integration_ws_idx on public.inbox_threads (integration_id, workspace_id);
create index inbox_threads_pending_idx on public.inbox_threads (workspace_id) where message_count > classified_count;
create trigger inbox_threads_set_updated_at before update on public.inbox_threads for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Mensajes
-- -----------------------------------------------------------------------------
create table public.inbox_messages (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  integration_id  uuid,
  thread_id       uuid not null,
  channel         text not null check (channel in ('email', 'telegram')),
  direction       text not null check (direction in ('in', 'out')),
  external_id     text not null check (char_length(external_id) between 1 and 200),
  sender_name     text check (sender_name is null or char_length(sender_name) <= 200),
  sender_address  text check (sender_address is null or char_length(sender_address) <= 320),
  recipients      text check (recipients is null or char_length(recipients) <= 2000),
  subject         text check (subject is null or char_length(subject) <= 300),
  body            text not null default '' check (char_length(body) <= 20000),
  sent_at         timestamptz not null default now(),
  run_id          uuid,
  created_at      timestamptz not null default now(),
  unique (workspace_id, channel, external_id),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete set null (integration_id),
  foreign key (thread_id, workspace_id)
    references public.inbox_threads (id, workspace_id) on delete cascade,
  foreign key (run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete set null (run_id)
);
create index inbox_messages_thread_idx on public.inbox_messages (thread_id, sent_at);
create index inbox_messages_thread_ws_idx on public.inbox_messages (thread_id, workspace_id);
create index inbox_messages_integration_ws_idx on public.inbox_messages (integration_id, workspace_id);
create index inbox_messages_run_ws_idx on public.inbox_messages (run_id, workspace_id);
create index inbox_messages_workspace_idx on public.inbox_messages (workspace_id, sent_at desc);

-- Registra un mensaje y actualiza su conversación en una sola operación.
-- Devuelve el id del mensaje, o null si ya estaba registrado.
create function public.inbox_record_message(
  p_workspace_id uuid,
  p_integration_id uuid,
  p_channel text,
  p_thread_external_id text,
  p_external_id text,
  p_direction text,
  p_sender_name text,
  p_sender_address text,
  p_recipients text,
  p_subject text,
  p_body text,
  p_sent_at timestamptz,
  p_contact_name text,
  p_contact_address text,
  p_run_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread uuid;
  v_id bigint;
begin
  insert into public.inbox_threads (workspace_id, integration_id, channel, external_id, subject, contact_name, contact_address, last_message_at)
  values (p_workspace_id, p_integration_id, p_channel, p_thread_external_id, left(nullif(p_subject, ''), 300),
          left(nullif(p_contact_name, ''), 200), left(nullif(p_contact_address, ''), 320), coalesce(p_sent_at, now()))
  on conflict (workspace_id, channel, external_id) do update
    set subject = coalesce(public.inbox_threads.subject, excluded.subject),
        contact_name = coalesce(excluded.contact_name, public.inbox_threads.contact_name),
        contact_address = coalesce(excluded.contact_address, public.inbox_threads.contact_address),
        integration_id = coalesce(excluded.integration_id, public.inbox_threads.integration_id),
        last_message_at = greatest(public.inbox_threads.last_message_at, excluded.last_message_at)
  returning id into v_thread;

  insert into public.inbox_messages (workspace_id, integration_id, thread_id, channel, direction, external_id, sender_name,
                                     sender_address, recipients, subject, body, sent_at, run_id)
  values (p_workspace_id, p_integration_id, v_thread, p_channel, p_direction, p_external_id, left(nullif(p_sender_name, ''), 200),
          left(nullif(p_sender_address, ''), 320), left(nullif(p_recipients, ''), 2000), left(nullif(p_subject, ''), 300),
          left(coalesce(p_body, ''), 20000), coalesce(p_sent_at, now()), p_run_id)
  on conflict (workspace_id, channel, external_id) do nothing
  returning id into v_id;

  if v_id is not null then
    update public.inbox_threads set message_count = message_count + 1 where id = v_thread;
  end if;
  return v_id;
end;
$$;
revoke all on function public.inbox_record_message(uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.inbox_record_message(uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, text, text, uuid)
  to service_role;

-- Borra los mensajes más antiguos que el plazo de conservación del espacio.
create function public.inbox_purge(p_workspace_id uuid, p_days int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_days is null or p_days < 1 then
    return 0;
  end if;
  delete from public.inbox_messages
  where workspace_id = p_workspace_id and sent_at < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  update public.inbox_threads t
  set message_count = (select count(*) from public.inbox_messages m where m.thread_id = t.id),
      classified_count = least(t.classified_count, (select count(*) from public.inbox_messages m where m.thread_id = t.id))
  where t.workspace_id = p_workspace_id;
  delete from public.inbox_threads where workspace_id = p_workspace_id and message_count = 0;
  return v_count;
end;
$$;
revoke all on function public.inbox_purge(uuid, int) from public, anon, authenticated;
grant execute on function public.inbox_purge(uuid, int) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Qué lanzó cada ejecución y ajustes de los flujos
-- -----------------------------------------------------------------------------
alter table public.flow_runs
  add column trigger jsonb not null default '{"type": "manual"}'::jsonb
  check (jsonb_typeof(trigger) = 'object' and pg_column_size(trigger) <= 16384);
grant select (trigger) on public.flow_runs to authenticated;

alter table public.flows
  add column settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192);
grant update (settings) on public.flows to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.contacts, public.inbox_threads, public.inbox_messages from anon, authenticated;

grant select on public.contacts to authenticated;
grant insert (workspace_id, name, email, created_by) on public.contacts to authenticated;
grant update (name) on public.contacts to authenticated;
grant delete on public.contacts to authenticated;

grant select on public.inbox_threads to authenticated;
grant select on public.inbox_messages to authenticated;
-- Correcciones manuales de la clasificación.
grant update (category, client, project, urgency, needs_reply, archived, manually_edited) on public.inbox_threads to authenticated;

alter table public.contacts       enable row level security;
alter table public.inbox_threads  enable row level security;
alter table public.inbox_messages enable row level security;

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

-- Bandeja: solo admins y owners (correo y chats con datos de terceros).
create policy inbox_threads_select_admin on public.inbox_threads
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

create policy inbox_threads_update_admin on public.inbox_threads
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));

create policy inbox_messages_select_admin on public.inbox_messages
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));
