-- Fase 11-1: servidor MCP de MarchaSolo (spec claude/spec-fase-11-servidor-mcp.md).
--
-- Una «conexión de asistente» deja que Claude, ChatGPT, Grok Bot u otro cliente
-- MCP lea y ordene la bandeja de un espacio y le deje borradores. Nunca envía:
-- cada borrador es una tarjeta que espera aprobación en MarchaSolo.
--
-- Dos tipos de conexión:
-- * oauth:   el asistente inicia sesión con el servidor OAuth 2.1 de Supabase
--            Auth. Su token lleva el claim client_id; la persona elige el
--            espacio y los permisos en /oauth/consent.
-- * api_key: clave ms_live_… creada en Ajustes. Solo se guarda su hash.
--
-- Los tokens OAuth de asistentes NO valen fuera de /mcp: private.is_member y
-- private.has_role devuelven false si el token lleva client_id, así que la API
-- de datos no les deja ver ni tocar nada, y las Edge Functions los rechazan
-- (core.ts). La función mcp trabaja con service_role y el espacio fijado.

-- -----------------------------------------------------------------------------
-- 1. Los tokens de asistentes no pasan por la RLS de la app
-- -----------------------------------------------------------------------------
create or replace function private.is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt() ->> 'client_id') is null
    and exists (
      select 1
      from public.memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    );
$$;

create or replace function private.has_role(p_workspace_id uuid, p_min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt() ->> 'client_id') is null
    and exists (
      select 1
      from public.memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and private.role_rank(m.role) >= private.role_rank(p_min_role)
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. Conexiones y registro de llamadas
-- -----------------------------------------------------------------------------
create table public.mcp_connections (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  -- Quien la creó: los borradores salen a su nombre y debe seguir siendo admin.
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  kind            text not null check (kind in ('oauth', 'api_key')),
  oauth_client_id text check (oauth_client_id is null or char_length(oauth_client_id) between 1 and 200),
  key_prefix      text check (key_prefix is null or key_prefix ~ '^ms_live_[0-9a-f]{4}$'),
  key_hash        text check (key_hash is null or key_hash ~ '^[0-9a-f]{64}$'),
  scopes          text[] not null default '{read}'
                  check (scopes <@ array['read', 'organize', 'drafts']::text[] and 'read' = any (scopes)),
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  check ((kind = 'oauth' and oauth_client_id is not null and key_hash is null and key_prefix is null)
      or (kind = 'api_key' and oauth_client_id is null and key_hash is not null and key_prefix is not null))
);
create unique index mcp_connections_key_hash_idx on public.mcp_connections (key_hash) where key_hash is not null;
-- Un asistente OAuth por persona y cliente activo a la vez (al volver a
-- autorizarlo, sustituye al anterior).
create unique index mcp_connections_oauth_active_idx on public.mcp_connections (user_id, oauth_client_id)
  where kind = 'oauth' and revoked_at is null;
create index mcp_connections_workspace_idx on public.mcp_connections (workspace_id, created_at desc);

comment on table public.mcp_connections is 'Asistentes (MCP) conectados a un espacio. De las claves solo se guarda el hash.';

-- Sin texto ni teléfonos: herramienta, resultado y código de error. 90 días.
create table public.mcp_calls (
  id            bigint generated always as identity primary key,
  connection_id uuid not null references public.mcp_connections (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  tool          text not null check (char_length(tool) between 1 and 60),
  ok            boolean not null,
  error_code    text check (error_code is null or char_length(error_code) <= 40),
  created_at    timestamptz not null default now()
);
create index mcp_calls_connection_idx on public.mcp_calls (connection_id, created_at desc);
create index mcp_calls_workspace_idx on public.mcp_calls (workspace_id, created_at desc);

alter table public.mcp_connections enable row level security;
alter table public.mcp_calls enable row level security;

create policy mcp_connections_select_admin on public.mcp_connections
  for select to authenticated using (private.has_role(workspace_id, 'admin'));
create policy mcp_calls_select_admin on public.mcp_calls
  for select to authenticated using (private.has_role(workspace_id, 'admin'));

-- Se crean y se revocan solo con las funciones de abajo.
revoke all on public.mcp_connections, public.mcp_calls from anon, authenticated;
grant select (id, workspace_id, user_id, name, kind, oauth_client_id, key_prefix, scopes, created_at, last_used_at, revoked_at)
  on public.mcp_connections to authenticated;
grant select on public.mcp_calls to authenticated;
grant all on public.mcp_connections, public.mcp_calls to service_role;

-- -----------------------------------------------------------------------------
-- 3. Límites (spec, sección 4)
-- -----------------------------------------------------------------------------
-- Prueba gratuita = espacio sin IA propia conectada. Con IA propia, los límites
-- de los planes de pago.
create function private.mcp_limits(p_workspace_id uuid)
returns table (connections int, per_minute int, per_day int, drafts_per_day int, drafts_pending int)
language sql
stable
security definer
set search_path = ''
as $$
  select case when paid then 5 else 2 end,
         case when paid then 60 else 30 end,
         case when paid then 3000 else 500 end,
         case when paid then 100 else 20 end,
         case when paid then 50 else 20 end
  from (
    select exists (
      select 1 from public.ai_connections a where a.workspace_id = p_workspace_id and a.status = 'active'
    ) as paid
  ) t;
$$;
revoke all on function private.mcp_limits(uuid) from public, anon, authenticated;
grant execute on function private.mcp_limits(uuid) to service_role;

create function private.mcp_normalize_scopes(p_scopes text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array(
    select s from unnest(array['read', 'organize', 'drafts']) s
    where s = 'read' or s = any (coalesce(p_scopes, '{}'))
  );
$$;
revoke all on function private.mcp_normalize_scopes(text[]) from public, anon, authenticated;

-- Para quien crea una conexión: owner o admin, con su sesión normal (no con un
-- token de asistente), y sin pasar del máximo de conexiones activas.
create function private.mcp_check_new(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
  v_active int;
begin
  if (select auth.uid()) is null or not private.has_role(p_workspace_id, 'admin') then
    raise exception 'Solo owners y admins pueden conectar asistentes.' using errcode = '42501';
  end if;
  select connections into v_max from private.mcp_limits(p_workspace_id);
  select count(*) into v_active from public.mcp_connections c
  where c.workspace_id = p_workspace_id and c.revoked_at is null;
  if v_active >= v_max then
    raise exception 'Este espacio ya tiene % conexiones de asistentes activas. Revoca una para crear otra.', v_max
      using errcode = 'P0001', hint = 'mcp_max_connections';
  end if;
end;
$$;
revoke all on function private.mcp_check_new(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Funciones para la persona (Ajustes y /oauth/consent)
-- -----------------------------------------------------------------------------
-- Crea una clave. Devuelve la clave en claro una sola vez.
create function public.mcp_key_create(p_workspace_id uuid, p_name text, p_scopes text[])
returns table (id uuid, api_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_id  uuid;
begin
  perform private.mcp_check_new(p_workspace_id);
  v_key := 'ms_live_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.mcp_connections (workspace_id, user_id, name, kind, key_prefix, key_hash, scopes)
  values (p_workspace_id, (select auth.uid()), btrim(p_name), 'api_key', left(v_key, 12),
          encode(extensions.digest(v_key, 'sha256'), 'hex'), private.mcp_normalize_scopes(p_scopes))
  returning mcp_connections.id into v_id;
  return query select v_id, v_key;
end;
$$;
revoke all on function public.mcp_key_create(uuid, text, text[]) from public, anon;
grant execute on function public.mcp_key_create(uuid, text, text[]) to authenticated;

-- Tras aprobar en /oauth/consent: guarda el espacio y los permisos elegidos
-- para ese cliente OAuth. Si ya había una conexión de la persona con el mismo
-- cliente, se revoca y se crea la nueva.
create function public.mcp_oauth_connect(p_workspace_id uuid, p_client_id text, p_name text, p_scopes text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.mcp_connections c set revoked_at = now()
  where c.user_id = (select auth.uid()) and c.kind = 'oauth' and c.oauth_client_id = p_client_id and c.revoked_at is null;
  perform private.mcp_check_new(p_workspace_id);
  insert into public.mcp_connections (workspace_id, user_id, name, kind, oauth_client_id, scopes)
  values (p_workspace_id, (select auth.uid()), left(btrim(coalesce(nullif(btrim(p_name), ''), 'Asistente')), 80), 'oauth',
          p_client_id, private.mcp_normalize_scopes(p_scopes))
  returning mcp_connections.id into v_id;
  return v_id;
end;
$$;
revoke all on function public.mcp_oauth_connect(uuid, text, text, text[]) from public, anon;
grant execute on function public.mcp_oauth_connect(uuid, text, text, text[]) to authenticated;

-- Revocar: owners y admins del espacio. Devuelve el cliente OAuth (si lo hay)
-- para retirar también la autorización en Supabase Auth.
create function public.mcp_connection_revoke(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.mcp_connections%rowtype;
begin
  select * into v_row from public.mcp_connections c where c.id = p_id;
  if not found or not private.has_role(v_row.workspace_id, 'admin') then
    raise exception 'No existe esa conexión.' using errcode = '42501';
  end if;
  update public.mcp_connections c set revoked_at = coalesce(c.revoked_at, now()) where c.id = p_id;
  return v_row.oauth_client_id;
end;
$$;
revoke all on function public.mcp_connection_revoke(uuid) from public, anon;
grant execute on function public.mcp_connection_revoke(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Funciones para la función mcp (solo service_role)
-- -----------------------------------------------------------------------------
-- Busca la conexión de una clave o de un token OAuth (persona + cliente). Solo
-- si no está revocada, no caducó (claves: 90 días sin uso) y quien la creó
-- sigue siendo owner o admin activo del espacio.
create function public.mcp_resolve(p_key_hash text, p_user_id uuid, p_client_id text)
returns table (id uuid, workspace_id uuid, user_id uuid, name text, kind text, scopes text[])
language sql
security definer
set search_path = ''
as $$
  select c.id, c.workspace_id, c.user_id, c.name, c.kind, c.scopes
  from public.mcp_connections c
  join public.memberships m on m.workspace_id = c.workspace_id and m.user_id = c.user_id
  where c.revoked_at is null
    and m.status = 'active' and m.role in ('owner', 'admin')
    and (
      (p_key_hash is not null and c.kind = 'api_key' and c.key_hash = p_key_hash
        and coalesce(c.last_used_at, c.created_at) > now() - interval '90 days')
      or (p_key_hash is null and c.kind = 'oauth' and c.user_id = p_user_id and c.oauth_client_id = p_client_id)
    )
  limit 1;
$$;
revoke all on function public.mcp_resolve(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mcp_resolve(text, uuid, text) to service_role;

-- Antes de cada llamada: ¿cabe en los límites? Devuelve null o el código
-- (rate_minute, rate_day). Marca el último uso.
create function public.mcp_check_rate(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
  v_lim record;
begin
  select c.workspace_id into v_ws from public.mcp_connections c where c.id = p_connection_id;
  if v_ws is null then return 'not_found'; end if;
  select * into v_lim from private.mcp_limits(v_ws);
  if (select count(*) from public.mcp_calls k
      where k.connection_id = p_connection_id and k.created_at > now() - interval '1 minute') >= v_lim.per_minute then
    return 'rate_minute';
  end if;
  if (select count(*) from public.mcp_calls k
      where k.workspace_id = v_ws and k.created_at > now() - interval '1 day') >= v_lim.per_day then
    return 'rate_day';
  end if;
  update public.mcp_connections c set last_used_at = now()
  where c.id = p_connection_id and (c.last_used_at is null or c.last_used_at < now() - interval '1 minute');
  return null;
end;
$$;
revoke all on function public.mcp_check_rate(uuid) from public, anon, authenticated;
grant execute on function public.mcp_check_rate(uuid) to service_role;

-- Límites de borradores del espacio: cuántos van hoy y cuántos esperan.
create function public.mcp_draft_usage(p_workspace_id uuid)
returns table (today int, pending int, max_today int, max_pending int)
language sql
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.flow_runs r
      where r.workspace_id = p_workspace_id and r.trigger ->> 'type' = 'mcp_draft'
        and r.started_at > now() - interval '1 day'),
    (select count(*)::int from public.flow_runs r
      where r.workspace_id = p_workspace_id and r.trigger ->> 'type' = 'mcp_draft'
        and r.status = 'awaiting_approval'),
    l.drafts_per_day,
    l.drafts_pending
  from private.mcp_limits(p_workspace_id) l;
$$;
revoke all on function public.mcp_draft_usage(uuid) from public, anon, authenticated;
grant execute on function public.mcp_draft_usage(uuid) to service_role;

-- Limpieza diaria del registro (90 días), con la de pg_cron si existe.
create function public.mcp_calls_purge()
returns int
language sql
security definer
set search_path = ''
as $$
  with d as (delete from public.mcp_calls where created_at < now() - interval '90 days' returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.mcp_calls_purge() from public, anon, authenticated;
grant execute on function public.mcp_calls_purge() to service_role;
