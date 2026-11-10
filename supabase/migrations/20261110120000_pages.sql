-- Fase 10-1: páginas vivas (spec claude/spec-fase-10-paginas-vivas.md).
-- Un documento Markdown del espacio que las automatizaciones actualizan (entero
-- o por secciones «## Nombre») y que guarda sus versiones. Solo owners y admins,
-- como la bandeja. Escribir una página no sale del espacio: no pide aprobación.
-- Compartir por enlace (10-2) va en otra migración.

create table public.pages (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 120),
  slug           text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  template       text check (template is null or char_length(template) <= 60),
  content_md     text not null default '' check (octet_length(content_md) <= 51200),
  -- Orden y nombre de las secciones «## …», calculados al guardar.
  sections       jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  -- De dónde salen los datos, p. ej. {"tokko_property_id": "123"}.
  source_ref     jsonb not null default '{}'::jsonb check (jsonb_typeof(source_ref) = 'object'),
  -- Automatización que la mantiene y última ejecución que la cambió.
  flow_id        uuid references public.flows (id) on delete set null,
  updated_by_run uuid references public.flow_runs (id) on delete set null,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  unique (workspace_id, slug)
);
create index pages_workspace_updated_idx on public.pages (workspace_id, updated_at desc);

create table public.page_versions (
  id           bigint generated always as identity primary key,
  page_id      uuid not null references public.pages (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_md   text not null,
  flow_run_id  uuid references public.flow_runs (id) on delete set null,
  edited_by    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index page_versions_page_idx on public.page_versions (page_id, id desc);

alter table public.pages enable row level security;
alter table public.page_versions enable row level security;

create policy pages_select_admin on public.pages
  for select to authenticated using (private.has_role(workspace_id, 'admin'));
create policy pages_insert_admin on public.pages
  for insert to authenticated with check (private.has_role(workspace_id, 'admin'));
create policy pages_update_admin on public.pages
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));
create policy pages_delete_admin on public.pages
  for delete to authenticated using (private.has_role(workspace_id, 'admin'));

create policy page_versions_select_admin on public.page_versions
  for select to authenticated using (private.has_role(workspace_id, 'admin'));

-- En Supabase, authenticated recibe todos los permisos por defecto: se quitan
-- primero para que los permisos de columna de abajo limiten de verdad.
revoke all on public.pages, public.page_versions from anon, authenticated;
grant select, delete on public.pages to authenticated;
grant insert (workspace_id, title, slug, template, content_md, sections, source_ref) on public.pages to authenticated;
-- A mano solo se cambian el título, el contenido y el archivo.
grant update (title, content_md, sections, archived_at) on public.pages to authenticated;
grant select on public.page_versions to authenticated;
grant all on public.pages, public.page_versions to service_role;

create trigger pages_set_updated_at before update on public.pages
  for each row execute function private.set_updated_at();

-- Cada cambio de contenido deja una versión: con la ejecución si vino de una
-- automatización, con la persona si fue a mano. Se guardan las 50 últimas.
create function private.page_record_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.content_md is not distinct from old.content_md then
    return null;
  end if;
  insert into public.page_versions (page_id, workspace_id, content_md, flow_run_id, edited_by)
  values (
    new.id,
    new.workspace_id,
    new.content_md,
    -- Sin usuario (service_role) es una ejecución; con usuario, una edición a
    -- mano. La app no puede tocar updated_by_run (no tiene permiso de columna).
    case when auth.uid() is null then new.updated_by_run end,
    auth.uid()
  );
  delete from public.page_versions v
   where v.page_id = new.id
     and v.id not in (select id from public.page_versions where page_id = new.id order by id desc limit 50);
  return null;
end;
$$;
revoke all on function private.page_record_version() from public, anon, authenticated;

create trigger pages_record_version
  after insert or update of content_md on public.pages
  for each row execute function private.page_record_version();
