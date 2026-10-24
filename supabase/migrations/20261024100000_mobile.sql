-- =============================================================================
-- Orkesta · Migración 6 · Fase móvil (PWA, chat que ejecuta, avisos, dictado)
-- -----------------------------------------------------------------------------
-- * push_subscriptions: avisos Web Push por dispositivo. Cada usuario ve y
--   borra las suyas; las claves del dispositivo (p256dh, auth) solo las lee
--   service_role (Edge Functions), que es quien envía los avisos.
-- * push_subscribe(): alta o renovación de un dispositivo. El endpoint es un
--   secreto del navegador: si otro usuario lo registró antes en ese mismo
--   dispositivo, pasa a ser del usuario actual.
-- * flow_runs.source_message_id: ejecuciones lanzadas desde un mensaje del
--   asistente («Ejecutar ahora»), sin guardar el flujo.
-- * usage_events.kind y audio_seconds: el consumo distingue texto y dictado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dispositivos suscritos a los avisos
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique
                check (char_length(endpoint) between 20 and 1000 and endpoint ~ '^https://'),
  p256dh        text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth          text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  user_agent    text not null default '' check (char_length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
comment on table public.push_subscriptions is 'Dispositivos que reciben avisos Web Push. Las claves solo las lee service_role.';

create function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select (id, user_id, endpoint, user_agent, created_at, last_used_at) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 2. Ejecuciones lanzadas desde el chat
-- -----------------------------------------------------------------------------
alter table public.flow_runs add column source_message_id bigint;
alter table public.flow_runs
  add constraint flow_runs_source_message_fkey
  foreign key (source_message_id, workspace_id)
  references public.messages (id, workspace_id) on delete set null (source_message_id);
create index flow_runs_source_message_idx on public.flow_runs (source_message_id, workspace_id);
grant select (source_message_id) on public.flow_runs to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Consumo: texto o dictado
-- -----------------------------------------------------------------------------
alter table public.usage_events
  add column kind text not null default 'text' check (kind in ('text', 'transcription')),
  add column audio_seconds numeric(7, 1) not null default 0 check (audio_seconds >= 0 and audio_seconds <= 3600);
