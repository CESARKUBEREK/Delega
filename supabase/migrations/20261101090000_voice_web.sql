-- Asistente de voz en la web del cliente (Grok Voice desde el navegador).
--
-- - voice_web_widgets: un asistente por espacio, con su identificador público
--   (va en el código que se pega en la web), si está activo y sus límites.
-- - voice_web_sessions: cada conversación iniciada (para limitar el uso por
--   día y por visitante, y validar las herramientas que pide el navegador).
-- - La bandeja admite el canal «web».
-- Va después de 20261031220000_google_contacts.sql.

create table public.voice_web_widgets (
  workspace_id         uuid primary key references public.workspaces (id) on delete cascade,
  public_id            text not null unique check (public_id ~ '^msw_[A-Za-z0-9_-]{20,60}$'),
  enabled              boolean not null default false,
  title                text not null default 'Habla con nosotros' check (char_length(title) between 1 and 60),
  sessions_per_day     int not null default 20 check (sessions_per_day between 1 and 500),
  minutes_per_session  int not null default 8 check (minutes_per_session between 1 and 30),
  -- Webs donde se puede insertar (dominios, sin https://). Vacío = cualquiera.
  allowed_domains      text[] not null default '{}' check (cardinality(allowed_domains) <= 10),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.voice_web_widgets enable row level security;

create policy voice_web_widgets_select_admin on public.voice_web_widgets
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

create policy voice_web_widgets_update_admin on public.voice_web_widgets
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));

revoke all on public.voice_web_widgets from anon;
grant select on public.voice_web_widgets to authenticated;
grant update (enabled, title, sessions_per_day, minutes_per_session, allowed_domains) on public.voice_web_widgets to authenticated;
grant all on public.voice_web_widgets to service_role;

create trigger voice_web_widgets_updated_at
  before update on public.voice_web_widgets
  for each row execute function private.set_updated_at();

create table public.voice_web_sessions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  secret_hash   text not null check (char_length(secret_hash) = 64),
  visitor_hash  text not null check (char_length(visitor_hash) = 64),
  origin        text check (origin is null or char_length(origin) <= 300),
  tool_calls    int not null default 0 check (tool_calls >= 0),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create index voice_web_sessions_ws_idx on public.voice_web_sessions (workspace_id, started_at desc);
create index voice_web_sessions_visitor_idx on public.voice_web_sessions (visitor_hash, started_at desc);

alter table public.voice_web_sessions enable row level security;

create policy voice_web_sessions_select_admin on public.voice_web_sessions
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

revoke all on public.voice_web_sessions from anon;
grant select on public.voice_web_sessions to authenticated;
grant all on public.voice_web_sessions to service_role;

alter table public.inbox_threads drop constraint inbox_threads_channel_check;
alter table public.inbox_threads
  add constraint inbox_threads_channel_check check (channel in ('email', 'telegram', 'whatsapp', 'phone', 'web'));

alter table public.inbox_messages drop constraint inbox_messages_channel_check;
alter table public.inbox_messages
  add constraint inbox_messages_channel_check check (channel in ('email', 'telegram', 'whatsapp', 'phone', 'web'));
