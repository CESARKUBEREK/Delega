-- Fase 6G: bandeja de acciones.
--
-- - Clasificación automática: de dónde sale la categoría (regla, contacto, IA o
--   la persona), si la conversación es automática (boletines y avisos) y si el
--   remitente es un contacto conocido.
-- - Dirección y fecha del último mensaje, para los seguimientos («escribiste y
--   no ha contestado»).
-- - Respuesta preparada: la ejecución del agente que la prepara, y si la
--   persona descartó la tarjeta.
-- - Reglas de clasificación por remitente o dominio (inbox_rules).

alter table public.inbox_threads
  add column category_source text check (category_source is null or category_source in ('rule', 'contact', 'ai', 'user')),
  add column automatic boolean not null default false,
  add column known_contact boolean not null default false,
  add column last_direction text check (last_direction is null or last_direction in ('in', 'out')),
  add column last_direction_at timestamptz,
  add column followup_muted boolean not null default false,
  add column prepare_run_id uuid,
  add column prepare_dismissed_at timestamptz,
  add foreign key (prepare_run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete set null (prepare_run_id);

grant update (category_source, automatic, followup_muted, prepare_dismissed_at) on public.inbox_threads to authenticated;

update public.inbox_threads
set category_source = case when manually_edited then 'user' when classified_at is not null then 'ai' end;

update public.inbox_threads t
set last_direction = m.direction, last_direction_at = m.sent_at
from (
  select distinct on (thread_id) thread_id, direction, sent_at
  from public.inbox_messages
  order by thread_id, sent_at desc
) m
where m.thread_id = t.id;

-- Cola de clasificación: conversaciones con mensajes sin clasificar, de la más
-- reciente a la más antigua.
create index inbox_threads_unclassified_idx on public.inbox_threads (workspace_id, last_message_at desc)
  where message_count > classified_count and not archived;

-- Seguimientos: conversaciones cuyo último mensaje es nuestro.
create index inbox_threads_followup_idx on public.inbox_threads (workspace_id, last_direction_at)
  where last_direction = 'out' and not archived and not followup_muted;

create index inbox_threads_prepare_run_idx on public.inbox_threads (prepare_run_id, workspace_id) where prepare_run_id is not null;

-- Dirección del último mensaje de cada conversación.
create function private.inbox_track_direction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inbox_threads
  set last_direction = new.direction,
      last_direction_at = new.sent_at,
      -- Si el contacto vuelve a escribir, la tarjeta descartada puede volver.
      prepare_dismissed_at = case when new.direction = 'in' then null else prepare_dismissed_at end
  where id = new.thread_id
    and (last_direction_at is null or new.sent_at >= last_direction_at);
  return null;
end;
$$;
revoke all on function private.inbox_track_direction() from public, anon, authenticated;

create trigger inbox_messages_track_direction
  after insert on public.inbox_messages
  for each row execute function private.inbox_track_direction();

-- Reglas de clasificación: «siempre esta categoría para este remitente o
-- dominio». Se aplican antes que la IA. Solo owners y admins.
create table public.inbox_rules (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  match_type   text not null check (match_type in ('sender', 'domain')),
  value        text not null check (char_length(value) between 3 and 320 and value = lower(value)),
  category     text not null check (char_length(category) between 1 and 60),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, match_type, value)
);

alter table public.inbox_rules enable row level security;

create policy inbox_rules_select_admin on public.inbox_rules
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

create policy inbox_rules_insert_admin on public.inbox_rules
  for insert to authenticated
  with check (private.has_role(workspace_id, 'admin'));

create policy inbox_rules_update_admin on public.inbox_rules
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));

create policy inbox_rules_delete_admin on public.inbox_rules
  for delete to authenticated
  using (private.has_role(workspace_id, 'admin'));

revoke all on public.inbox_rules from anon;
grant select, insert, delete on public.inbox_rules to authenticated;
grant update (category) on public.inbox_rules to authenticated;
grant all on public.inbox_rules to service_role;

-- Espacios con conversaciones por clasificar (para runs-cron), primero los que
-- más esperan. Solo service_role.
create function public.inbox_workspaces_pending(p_limit int)
returns table (workspace_id uuid, pending bigint)
language sql
security definer
set search_path = ''
as $$
  select t.workspace_id, count(*) as pending
  from public.inbox_threads t
  where t.message_count > t.classified_count and not t.archived
    and exists (select 1 from public.ai_connections a where a.workspace_id = t.workspace_id and a.status = 'active')
  group by t.workspace_id
  order by min(t.updated_at)
  limit greatest(1, least(p_limit, 20));
$$;
revoke all on function public.inbox_workspaces_pending(int) from public, anon, authenticated;
grant execute on function public.inbox_workspaces_pending(int) to service_role;
