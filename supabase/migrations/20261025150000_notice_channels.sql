-- =============================================================================
-- Orkesta · Migración 12 · Zona horaria del espacio y canales de aviso
-- -----------------------------------------------------------------------------
-- * workspaces.timezone: zona horaria del espacio (la cambia un owner o admin).
--   La usan las ejecuciones programadas; si no hay, la de Google Calendar y,
--   si tampoco, Europe/Madrid. Al cambiarla se recalcula la próxima ejecución.
-- * user_channels: cómo quiere cada persona recibir sus avisos en cada espacio
--   (push, correo, Telegram) y su chat de Telegram vinculado con el bot del
--   espacio mediante un código de un solo uso (/vincular CÓDIGO).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Zona horaria del espacio
-- -----------------------------------------------------------------------------
create function private.is_timezone(p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz);
$$;

alter table public.workspaces add column timezone text;
create function private.workspaces_check_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null and not private.is_timezone(new.timezone) then
    raise exception 'Zona horaria no válida' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger workspaces_check_timezone
  before insert or update of timezone on public.workspaces
  for each row execute function private.workspaces_check_timezone();

create or replace function private.workspace_timezone(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select w.timezone from public.workspaces w where w.id = p_workspace_id and w.timezone is not null),
    (select nullif(i.config ->> 'timezone', '')
     from public.integrations i
     where i.workspace_id = p_workspace_id and i.provider = 'calendar'
       and private.is_timezone(i.config ->> 'timezone')),
    'Europe/Madrid');
$$;

-- Cambiar la zona horaria (owner o admin) y recalcular las programadas.
create function public.workspace_set_timezone(p_workspace_id uuid, p_timezone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_workspace_id, 'admin') then
    raise exception 'Solo un administrador puede cambiar la zona horaria' using errcode = '42501';
  end if;
  if p_timezone is not null and not private.is_timezone(p_timezone) then
    raise exception 'Zona horaria no válida' using errcode = '22023';
  end if;
  update public.workspaces set timezone = p_timezone where id = p_workspace_id;
  update public.flows f
  set next_run_at = private.flow_next_run(f.settings -> 'schedule', private.workspace_timezone(f.workspace_id), now())
  where f.workspace_id = p_workspace_id and f.status = 'active' and f.next_run_at is not null;
  return private.workspace_timezone(p_workspace_id);
end;
$$;
revoke all on function public.workspace_set_timezone(uuid, text) from public, anon;
grant execute on function public.workspace_set_timezone(uuid, text) to authenticated;

revoke all on function private.is_timezone(text) from public, anon, authenticated;
revoke all on function private.workspaces_check_timezone() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Canales de aviso de cada persona
-- -----------------------------------------------------------------------------
create table public.user_channels (
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  notify_push         boolean not null default true,
  notify_email        boolean not null default true,
  notify_telegram     boolean not null default true,
  telegram_chat_id    text check (telegram_chat_id is null or telegram_chat_id ~ '^-?[0-9]{1,20}$'),
  telegram_name       text check (telegram_name is null or char_length(telegram_name) <= 200),
  -- Código de vinculación: solo se guarda su huella (sha256) y caduca en 15 min.
  link_code_hash      text,
  link_code_expires   timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index user_channels_user_idx on public.user_channels (user_id);
create unique index user_channels_code_idx on public.user_channels (link_code_hash) where link_code_hash is not null;

alter table public.user_channels enable row level security;
revoke all on table public.user_channels from anon, authenticated;
-- Cada persona ve sus propios canales (sin el código).
grant select (workspace_id, user_id, notify_push, notify_email, notify_telegram, telegram_chat_id, telegram_name, link_code_expires, updated_at)
  on public.user_channels to authenticated;
create policy user_channels_select_own on public.user_channels
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_member(workspace_id));

-- Guardar las preferencias propias.
create function public.notice_prefs_set(p_workspace_id uuid, p_push boolean, p_email boolean, p_telegram boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_workspace_id) then
    raise exception 'No perteneces a este espacio' using errcode = '42501';
  end if;
  insert into public.user_channels (workspace_id, user_id, notify_push, notify_email, notify_telegram)
  values (p_workspace_id, (select auth.uid()), coalesce(p_push, true), coalesce(p_email, true), coalesce(p_telegram, true))
  on conflict (workspace_id, user_id) do update
    set notify_push = excluded.notify_push, notify_email = excluded.notify_email,
        notify_telegram = excluded.notify_telegram, updated_at = now();
end;
$$;

-- Empezar a vincular Telegram: devuelve un código de 8 caracteres (15 min).
create function public.telegram_link_start(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_member(p_workspace_id) then
    raise exception 'No perteneces a este espacio' using errcode = '42501';
  end if;
  -- Sin caracteres que se confundan (0/O, 1/I).
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
  into v_code
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) i;
  insert into public.user_channels (workspace_id, user_id, link_code_hash, link_code_expires)
  values (p_workspace_id, (select auth.uid()), encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes')
  on conflict (workspace_id, user_id) do update
    set link_code_hash = excluded.link_code_hash, link_code_expires = excluded.link_code_expires, updated_at = now();
  return v_code;
end;
$$;

-- Desvincular el chat de Telegram propio.
create function public.telegram_unlink(p_workspace_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_channels
  set telegram_chat_id = null, telegram_name = null, link_code_hash = null, link_code_expires = null, updated_at = now()
  where workspace_id = p_workspace_id and user_id = (select auth.uid());
$$;

-- Completar la vinculación (lo llama telegram-webhook con service_role al
-- recibir «/vincular CÓDIGO» en un chat privado con el bot del espacio).
create function public.telegram_link_complete(p_workspace_id uuid, p_code text, p_chat_id text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{8}$' or p_chat_id !~ '^-?[0-9]{1,20}$' then
    return null;
  end if;
  update public.user_channels c
  set telegram_chat_id = p_chat_id, telegram_name = left(nullif(p_name, ''), 200),
      link_code_hash = null, link_code_expires = null, updated_at = now()
  where c.workspace_id = p_workspace_id
    and c.link_code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
    and c.link_code_expires > now()
    and exists (select 1 from public.memberships m
                where m.workspace_id = c.workspace_id and m.user_id = c.user_id and m.status = 'active')
  returning c.user_id into v_user;
  return v_user;
end;
$$;

revoke all on function public.notice_prefs_set(uuid, boolean, boolean, boolean) from public, anon;
revoke all on function public.telegram_link_start(uuid) from public, anon;
revoke all on function public.telegram_unlink(uuid) from public, anon;
grant execute on function public.notice_prefs_set(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.telegram_link_start(uuid) to authenticated;
grant execute on function public.telegram_unlink(uuid) to authenticated;
revoke all on function public.telegram_link_complete(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.telegram_link_complete(uuid, text, text, text) to service_role;
