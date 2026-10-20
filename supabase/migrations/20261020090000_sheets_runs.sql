-- =============================================================================
-- Delega · Migración 3 · Integración con Google (planillas) y ejecución de flujos
-- -----------------------------------------------------------------------------
-- Crea: integrations (el refresh token de Google vive en Vault), oauth_states
--       (estado temporal del OAuth, solo service_role), integration_files
--       (planillas que el usuario eligió con el selector de Google), flow_runs
--       (ejecuciones del agente, con su acción pendiente de aprobación) y
--       run_events (bitácora de cada ejecución).
-- Además añade los índices que pidieron los advisors tras la migración 2.
--
-- Principios (los mismos que en las migraciones 1 y 2):
--   * Todo lleva workspace_id y RLS; FK compuestas (id, workspace_id).
--   * Los tokens de Google nunca llegan al navegador: vault_secret_id no se
--     concede y solo service_role los descifra.
--   * Las ejecuciones las escriben solo las Edge Functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Índices pendientes de la migración 2 (FK compuestas y created_by)
-- -----------------------------------------------------------------------------
create index ai_connections_created_by_idx on public.ai_connections (created_by);
create index messages_conversation_ws_idx  on public.messages (conversation_id, workspace_id);
create index flows_source_message_ws_idx   on public.flows (source_message_id, workspace_id);
create index usage_events_conversation_ws_idx on public.usage_events (conversation_id, workspace_id);
-- Quedan cubiertos por los índices compuestos anteriores.
drop index public.flows_source_message_idx;
drop index public.usage_events_conversation_idx;

-- Las ejecuciones apuntan a (flow_id, workspace_id).
alter table public.flows add constraint flows_id_workspace_key unique (id, workspace_id);

-- -----------------------------------------------------------------------------
-- 1. Integraciones con servicios externos (una por proveedor y espacio)
-- -----------------------------------------------------------------------------
create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  provider        text not null check (provider in ('google')),
  account_email   text check (account_email is null or char_length(account_email) <= 320),
  scopes          text not null default '' check (char_length(scopes) <= 1000),
  vault_secret_id uuid not null,
  status          text not null default 'active' check (status in ('active', 'invalid')),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, provider),
  unique (id, workspace_id)
);
create index integrations_created_by_idx on public.integrations (created_by);
comment on table public.integrations is 'Conexión OAuth por espacio y proveedor. El refresh token está cifrado en Vault (vault_secret_id).';

-- Estado temporal del flujo OAuth (PKCE). Solo lo usa service_role.
create table public.oauth_states (
  id             uuid primary key default gen_random_uuid(),
  state_hash     text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null check (provider in ('google')),
  code_verifier  text not null check (char_length(code_verifier) between 43 and 128),
  redirect_uri   text not null check (char_length(redirect_uri) <= 500),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '10 minutes'
);
create index oauth_states_workspace_idx on public.oauth_states (workspace_id);
create index oauth_states_user_idx on public.oauth_states (user_id);
create index oauth_states_expires_idx on public.oauth_states (expires_at);

-- Archivos que el usuario eligió con el selector de Google (permiso drive.file:
-- Delega solo puede abrir estos).
create table public.integration_files (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  integration_id    uuid not null,
  provider_file_id  text not null check (provider_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  name              text not null check (char_length(name) between 1 and 300),
  mime_type         text check (mime_type is null or char_length(mime_type) <= 200),
  url               text check (url is null or char_length(url) <= 1000),
  added_by          uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (integration_id, provider_file_id),
  unique (id, workspace_id),
  foreign key (integration_id, workspace_id)
    references public.integrations (id, workspace_id) on delete cascade
);
create index integration_files_workspace_idx on public.integration_files (workspace_id, created_at desc);
create index integration_files_integration_ws_idx on public.integration_files (integration_id, workspace_id);
create index integration_files_added_by_idx on public.integration_files (added_by);

-- -----------------------------------------------------------------------------
-- 2. Ejecuciones de flujos y su bitácora
-- -----------------------------------------------------------------------------
create table public.flow_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  flow_id         uuid,
  flow_name       text not null check (char_length(flow_name) between 1 and 120),
  plan            jsonb not null check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 65536),
  status          text not null default 'running'
                  check (status in ('running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled')),
  file_ids        uuid[] not null default '{}' check (cardinality(file_ids) <= 5),
  note            text not null default '' check (char_length(note) <= 2000),
  model           text check (model is null or char_length(model) <= 80),
  -- Transcripción del agente (incluye datos leídos de las planillas): solo service_role.
  state           jsonb not null default '{"items": []}'::jsonb
                  check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 2000000),
  -- Escritura propuesta que espera la decisión del usuario.
  pending_action  jsonb check (pending_action is null or pg_column_size(pending_action) <= 300000),
  summary         text check (summary is null or char_length(summary) <= 8000),
  error           text check (error is null or char_length(error) <= 2000),
  tool_calls      int not null default 0 check (tool_calls >= 0),
  input_tokens    int not null default 0 check (input_tokens >= 0),
  output_tokens   int not null default 0 check (output_tokens >= 0),
  lease_until     timestamptz,
  started_by      uuid references auth.users (id) on delete set null,
  started_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  finished_at     timestamptz,
  unique (id, workspace_id),
  -- El historial sobrevive al borrado del flujo (queda el nombre y el plan).
  foreign key (flow_id, workspace_id)
    references public.flows (id, workspace_id) on delete set null (flow_id)
);
create index flow_runs_workspace_idx on public.flow_runs (workspace_id, started_at desc);
create index flow_runs_flow_ws_idx on public.flow_runs (flow_id, workspace_id);
create index flow_runs_started_by_idx on public.flow_runs (started_by, started_at desc);

create table public.run_events (
  id            bigint generated always as identity primary key,
  run_id        uuid not null,
  workspace_id  uuid not null,
  kind          text not null check (kind in ('started', 'tool', 'approval_requested', 'approved', 'rejected',
                                              'message', 'error', 'finished')),
  title         text not null check (char_length(title) between 1 and 300),
  detail        jsonb check (detail is null or pg_column_size(detail) <= 200000),
  created_at    timestamptz not null default now(),
  foreign key (run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete cascade
);
create index run_events_run_idx on public.run_events (run_id, id);
create index run_events_run_ws_idx on public.run_events (run_id, workspace_id);
create index run_events_workspace_idx on public.run_events (workspace_id);

-- -----------------------------------------------------------------------------
-- 3. updated_at
-- -----------------------------------------------------------------------------
create trigger integrations_set_updated_at before update on public.integrations for each row execute function private.set_updated_at();
create trigger flow_runs_set_updated_at    before update on public.flow_runs    for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Funciones de Vault para integraciones (solo service_role)
-- -----------------------------------------------------------------------------
create function public.integration_save(
  p_workspace_id uuid,
  p_provider text,
  p_refresh_token text,
  p_account_email text,
  p_scopes text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.integrations%rowtype;
  v_secret   uuid;
  v_id       uuid;
begin
  if p_refresh_token is null or char_length(p_refresh_token) not between 10 and 2000 then
    raise exception 'Token no válido' using errcode = '22023';
  end if;

  select * into v_existing from public.integrations i
  where i.workspace_id = p_workspace_id and i.provider = p_provider
  for update;

  if v_existing.id is null then
    v_secret := vault.create_secret(
      p_refresh_token,
      'integration:' || p_workspace_id::text || ':' || p_provider || ':' || gen_random_uuid()::text,
      'Refresh token de ' || p_provider || ' del espacio ' || p_workspace_id::text);
    insert into public.integrations (workspace_id, provider, account_email, scopes, vault_secret_id, status, created_by)
    values (p_workspace_id, p_provider, p_account_email, coalesce(p_scopes, ''), v_secret, 'active', p_actor)
    returning id into v_id;
  else
    perform vault.update_secret(v_existing.vault_secret_id, p_refresh_token);
    update public.integrations
    set account_email = p_account_email, scopes = coalesce(p_scopes, ''), status = 'active'
    where id = v_existing.id;
    v_id := v_existing.id;
  end if;

  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, p_actor, 'integration.connected', 'integration', v_id::text,
          jsonb_build_object('provider', p_provider));
  return v_id;
end;
$$;

create function public.integration_secret(p_workspace_id uuid, p_provider text)
returns table (integration_id uuid, refresh_token text, status text, account_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, ds.decrypted_secret, i.status, i.account_email
  from public.integrations i
  join vault.decrypted_secrets ds on ds.id = i.vault_secret_id
  where i.workspace_id = p_workspace_id and i.provider = p_provider;
$$;

create function public.integration_delete(p_workspace_id uuid, p_provider text, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.integrations%rowtype;
begin
  select * into v_row from public.integrations i
  where i.workspace_id = p_workspace_id and i.provider = p_provider
  for update;
  if v_row.id is null then
    return false;
  end if;
  -- El trigger borra también el secreto de Vault.
  delete from public.integrations where id = v_row.id;
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, p_actor, 'integration.disconnected', 'integration', v_row.id::text,
          jsonb_build_object('provider', p_provider));
  return true;
end;
$$;

create function public.integration_mark_invalid(p_workspace_id uuid, p_provider text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.integrations set status = 'invalid'
  where workspace_id = p_workspace_id and provider = p_provider;
$$;

revoke all on function public.integration_save(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.integration_secret(uuid, text)                       from public, anon, authenticated;
revoke all on function public.integration_delete(uuid, text, uuid)                 from public, anon, authenticated;
revoke all on function public.integration_mark_invalid(uuid, text)                 from public, anon, authenticated;
grant execute on function public.integration_save(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.integration_secret(uuid, text)                       to service_role;
grant execute on function public.integration_delete(uuid, text, uuid)                 to service_role;
grant execute on function public.integration_mark_invalid(uuid, text)                 to service_role;

create function private.integration_cleanup_secret()
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
revoke all on function private.integration_cleanup_secret() from public, anon, authenticated;

create trigger integrations_cleanup_secret
  after delete on public.integrations
  for each row execute function private.integration_cleanup_secret();

-- -----------------------------------------------------------------------------
-- 5. Privilegios y RLS
-- -----------------------------------------------------------------------------
revoke all on table public.integrations, public.oauth_states, public.integration_files,
                    public.flow_runs, public.run_events
  from anon, authenticated;

grant select (id, workspace_id, provider, account_email, scopes, status, created_by, created_at, updated_at)
  on public.integrations to authenticated;
grant select on public.integration_files to authenticated;
-- Nunca la transcripción (state) ni el lease.
grant select (id, workspace_id, flow_id, flow_name, plan, status, file_ids, note, model, pending_action,
              summary, error, tool_calls, input_tokens, output_tokens, started_by, started_at,
              updated_at, finished_at)
  on public.flow_runs to authenticated;
grant select on public.run_events to authenticated;
-- oauth_states: sin privilegios para clientes.

alter table public.integrations      enable row level security;
alter table public.oauth_states      enable row level security;
alter table public.integration_files enable row level security;
alter table public.flow_runs         enable row level security;
alter table public.run_events        enable row level security;

create policy integrations_select_member on public.integrations
  for select to authenticated
  using (private.is_member(workspace_id));

create policy integration_files_select_member on public.integration_files
  for select to authenticated
  using (private.is_member(workspace_id));

-- Ejecuciones: las ve quien las lanzó y los admins/owners del espacio.
create policy flow_runs_select on public.flow_runs
  for select to authenticated
  using (private.is_member(workspace_id)
         and (started_by = (select auth.uid()) or private.has_role(workspace_id, 'admin')));

create policy run_events_select on public.run_events
  for select to authenticated
  using (exists (
    select 1 from public.flow_runs r
    where r.id = run_events.run_id
      and r.workspace_id = run_events.workspace_id
      and private.is_member(r.workspace_id)
      and (r.started_by = (select auth.uid()) or private.has_role(r.workspace_id, 'admin'))
  ));
