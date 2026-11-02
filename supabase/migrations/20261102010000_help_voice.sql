-- Fase 7-4: conversación por voz en tiempo real con el ayudante (Grok Voice,
-- clave xAI del espacio). Opcional: apagada hasta que un administrador la
-- activa. Las sesiones se apuntan para limitar el gasto.
alter table public.workspaces
  add column if not exists help_voice_enabled boolean not null default false;

comment on column public.workspaces.help_voice_enabled is
  'Conversación por voz con el ayudante (usa la clave de xAI del espacio). La activa un administrador.';

-- authenticated solo puede actualizar workspaces.name: la opción se cambia
-- con esta función, solo administradores y owners.
create function public.workspace_set_help_voice(p_workspace_id uuid, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_workspace_id, 'admin') then
    return false;
  end if;
  update public.workspaces set help_voice_enabled = coalesce(p_enabled, false) where id = p_workspace_id;
  return true;
end;
$$;
revoke all on function public.workspace_set_help_voice(uuid, boolean) from public, anon;
grant execute on function public.workspace_set_help_voice(uuid, boolean) to authenticated, service_role;

-- Una fila por conversación de voz (para los límites: por persona y hora, por
-- espacio y día). Solo la escribe la función assistant (service_role).
create table public.help_voice_sessions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now()
);

create index help_voice_sessions_ws_idx on public.help_voice_sessions (workspace_id, started_at);
create index help_voice_sessions_user_idx on public.help_voice_sessions (user_id, started_at);

alter table public.help_voice_sessions enable row level security;

create policy help_voice_sessions_select_admin on public.help_voice_sessions
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

revoke all on public.help_voice_sessions from anon, authenticated;
grant select on public.help_voice_sessions to authenticated;
grant all on public.help_voice_sessions to service_role;
