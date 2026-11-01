-- Embudo del onboarding: la primera vez que cada persona llega a cada paso de
-- cada espacio. Sirve para saber dónde se abandona. Solo pasos y datos del
-- plan (origen, nombre, conexión); nada del contenido de la tarea.
create table public.onboarding_events (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  step         text not null check (step in ('task', 'plan', 'connect', 'connected', 'supervised', 'done')),
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id, step)
);

comment on table public.onboarding_events is
  'Primera llegada de cada persona a cada paso del onboarding. Se escribe con onboarding_track.';

create index onboarding_events_created_at_idx on public.onboarding_events (created_at);

alter table public.onboarding_events enable row level security;

-- Lectura: administradores del espacio. Escritura: solo con onboarding_track.
create policy onboarding_events_select_admin on public.onboarding_events
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

revoke all on public.onboarding_events from anon, authenticated;
grant select on public.onboarding_events to authenticated;
grant all on public.onboarding_events to service_role;

-- Registra un paso para quien llama (si es miembro del espacio). Solo la
-- primera vez; el detalle se limita a unas pocas claves conocidas.
create function public.onboarding_track(p_workspace_id uuid, p_step text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_member(p_workspace_id) then
    return;
  end if;
  insert into public.onboarding_events (workspace_id, user_id, step, detail)
  values (
    p_workspace_id,
    (select auth.uid()),
    p_step,
    jsonb_strip_nulls(jsonb_build_object(
      'source', left(p_detail ->> 'source', 20),
      'plan', left(p_detail ->> 'plan', 120),
      'needed', left(p_detail ->> 'needed', 20)
    ))
  )
  on conflict (workspace_id, user_id, step) do nothing;
end;
$$;
revoke all on function public.onboarding_track(uuid, text, jsonb) from public, anon;
grant execute on function public.onboarding_track(uuid, text, jsonb) to authenticated, service_role;
