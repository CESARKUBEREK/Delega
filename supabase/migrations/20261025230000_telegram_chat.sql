-- Chat propio con Orkesta por Telegram (ver supabase/functions/_shared/telegram-chat.ts).
--
-- telegram_chat_since: «/nuevo» marca desde cuándo cuenta la conversación; los
-- intercambios anteriores ya no se pasan como contexto al agente. Solo lo
-- escribe telegram-webhook (service_role); la persona puede verlo.
alter table public.user_channels add column telegram_chat_since timestamptz;
grant select (telegram_chat_since) on public.user_channels to authenticated;

-- Búsqueda del dueño de un chat (cada mensaje al bot la hace).
create index user_channels_telegram_chat_idx on public.user_channels (workspace_id, telegram_chat_id)
  where telegram_chat_id is not null;

-- Límite y contexto de las peticiones por Telegram de cada persona.
create index flow_runs_telegram_chat_idx on public.flow_runs (workspace_id, started_by, started_at desc)
  where trigger ->> 'type' = 'telegram_chat';
