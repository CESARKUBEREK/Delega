-- =============================================================================
-- Delega · Migración 4 · Google Docs, WhatsApp y disparadores por mensaje
-- -----------------------------------------------------------------------------
-- * integrations admite el proveedor 'whatsapp' y guarda configuración no
--   secreta en `config` (ID del número, número visible). Las credenciales
--   (token de acceso, secreto de la app, token de verificación) van juntas
--   como JSON en Vault, igual que el refresh token de Google.
-- * contacts: destinatarios autorizados por espacio. Un flujo solo puede
--   escribir por WhatsApp a estos contactos o a quien acaba de escribir.
-- * whatsapp_threads: una conversación por interlocutor, con la clasificación
--   que propone la IA (categoría, cliente, proyecto, urgencia, resumen).
-- * whatsapp_messages: mensajes entrantes, salientes, histórico y ecos de la
--   app WhatsApp Business (modo coexistencia).
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
-- 3. Conversaciones (una por interlocutor) y su clasificación
-- -----------------------------------------------------------------------------
create table public.whatsapp_threads (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  integration_id      uuid,
  phone               text not null check (phone ~ '^[0-9]{7,15}$'),
  contact_name        text check (contact_name is null or char_length(contact_name) <= 200),
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
  unique (workspace_id, phone),
  unique (id, workspace_id),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete set null (integration_id)
);
create index whatsapp_threads_workspace_idx on public.whatsapp_threads (workspace_id, last_message_at desc nulls last);
create index whatsapp_threads_integration_ws_idx on public.whatsapp_threads (integration_id, workspace_id);
create index whatsapp_threads_pending_idx on public.whatsapp_threads (workspace_id) where message_count > classified_count;
create trigger whatsapp_threads_set_updated_at before update on public.whatsapp_threads for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Mensajes de WhatsApp
-- -----------------------------------------------------------------------------
create table public.whatsapp_messages (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  integration_id  uuid,
  thread_id       uuid,
  direction       text not null check (direction in ('in', 'out')),
  source          text not null default 'live' check (source in ('live', 'history', 'echo', 'api')),
  phone           text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  contact_name    text check (contact_name is null or char_length(contact_name) <= 200),
  body            text not null default '' check (char_length(body) <= 4096),
  message_type    text not null default 'text' check (char_length(message_type) <= 40),
  wa_message_id   text unique check (wa_message_id is null or char_length(wa_message_id) <= 200),
  status          text check (status is null or char_length(status) <= 40),
  run_id          uuid,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete set null (integration_id),
  foreign key (thread_id, workspace_id)
    references public.whatsapp_threads (id, workspace_id) on delete cascade,
  foreign key (run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete set null (run_id)
);
create index whatsapp_messages_workspace_idx on public.whatsapp_messages (workspace_id, created_at desc);
create index whatsapp_messages_integration_ws_idx on public.whatsapp_messages (integration_id, workspace_id);
create index whatsapp_messages_thread_idx on public.whatsapp_messages (thread_id, sent_at);
create index whatsapp_messages_thread_ws_idx on public.whatsapp_messages (thread_id, workspace_id);
create index whatsapp_messages_run_ws_idx on public.whatsapp_messages (run_id, workspace_id);
create index whatsapp_messages_phone_idx on public.whatsapp_messages (workspace_id, phone, created_at desc);

-- Registra un mensaje y actualiza su conversación en una sola operación.
-- Devuelve el id del mensaje, o null si ya existía (reintento de Meta).
create function public.whatsapp_record_message(
  p_workspace_id uuid,
  p_integration_id uuid,
  p_counterpart text,
  p_contact_name text,
  p_direction text,
  p_source text,
  p_body text,
  p_type text,
  p_wa_message_id text,
  p_sent_at timestamptz,
  p_status text default null,
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
  insert into public.whatsapp_threads (workspace_id, integration_id, phone, contact_name, last_message_at)
  values (p_workspace_id, p_integration_id, p_counterpart, nullif(p_contact_name, ''), p_sent_at)
  on conflict (workspace_id, phone) do update
    set contact_name = coalesce(nullif(excluded.contact_name, ''), public.whatsapp_threads.contact_name),
        integration_id = coalesce(excluded.integration_id, public.whatsapp_threads.integration_id),
        last_message_at = greatest(public.whatsapp_threads.last_message_at, excluded.last_message_at)
  returning id into v_thread;

  insert into public.whatsapp_messages (workspace_id, integration_id, thread_id, direction, source, phone, contact_name,
                                        body, message_type, wa_message_id, status, run_id, sent_at)
  values (p_workspace_id, p_integration_id, v_thread, p_direction, p_source, p_counterpart, nullif(p_contact_name, ''),
          left(coalesce(p_body, ''), 4096), left(coalesce(p_type, 'text'), 40), p_wa_message_id, p_status, p_run_id,
          coalesce(p_sent_at, now()))
  on conflict (wa_message_id) do nothing
  returning id into v_id;

  if v_id is not null then
    update public.whatsapp_threads set message_count = message_count + 1 where id = v_thread;
  end if;
  return v_id;
end;
$$;
revoke all on function public.whatsapp_record_message(uuid, uuid, text, text, text, text, text, text, text, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.whatsapp_record_message(uuid, uuid, text, text, text, text, text, text, text, timestamptz, text, uuid)
  to service_role;

-- Integración de WhatsApp a partir del número (webhook central de la app de Delega).
create function public.integration_by_phone_number_id(p_phone_number_id text)
returns table (integration_id uuid, workspace_id uuid, secret text, status text, config jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.workspace_id, ds.decrypted_secret, i.status, i.config
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.provider = 'whatsapp' and i.config ->> 'phone_number_id' = p_phone_number_id
  limit 1;
$$;
revoke all on function public.integration_by_phone_number_id(text) from public, anon, authenticated;
grant execute on function public.integration_by_phone_number_id(text) to service_role;

-- Un número de WhatsApp solo puede estar conectado a un espacio.
create unique index integrations_whatsapp_phone_key
  on public.integrations ((config ->> 'phone_number_id'))
  where provider = 'whatsapp' and config ? 'phone_number_id';

-- Borra los mensajes más antiguos que el plazo de conservación del espacio.
create function public.whatsapp_purge(p_workspace_id uuid, p_days int)
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
  delete from public.whatsapp_messages
  where workspace_id = p_workspace_id and sent_at < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  update public.whatsapp_threads t
  set message_count = (select count(*) from public.whatsapp_messages m where m.thread_id = t.id),
      classified_count = least(t.classified_count, (select count(*) from public.whatsapp_messages m where m.thread_id = t.id))
  where t.workspace_id = p_workspace_id;
  delete from public.whatsapp_threads where workspace_id = p_workspace_id and message_count = 0;
  return v_count;
end;
$$;
revoke all on function public.whatsapp_purge(uuid, int) from public, anon, authenticated;
grant execute on function public.whatsapp_purge(uuid, int) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Qué lanzó cada ejecución
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
-- 6. Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.contacts, public.whatsapp_messages, public.whatsapp_threads from anon, authenticated;

grant select on public.contacts to authenticated;
grant insert (workspace_id, name, phone, created_by) on public.contacts to authenticated;
grant update (name) on public.contacts to authenticated;
grant delete on public.contacts to authenticated;

grant select on public.whatsapp_messages to authenticated;
grant select on public.whatsapp_threads to authenticated;
-- Correcciones manuales de la clasificación.
grant update (category, client, project, urgency, needs_reply, archived, manually_edited) on public.whatsapp_threads to authenticated;

alter table public.contacts          enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_threads  enable row level security;

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

-- Conversaciones: solo admins y owners; pueden corregir la clasificación.
create policy whatsapp_threads_select_admin on public.whatsapp_threads
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

create policy whatsapp_threads_update_admin on public.whatsapp_threads
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));
