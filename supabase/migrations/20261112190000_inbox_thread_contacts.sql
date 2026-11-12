-- MarchaSolo Inbox: asociaciones explícitas entre hilos y contactos.
-- No fusiona ni modifica los hilos originales. Una asociación activa por hilo;
-- el historial se conserva al desvincular mediante revoked_at/revoked_by.

create table public.inbox_thread_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null,
  contact_id uuid not null,
  confirmed_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint inbox_thread_contacts_revocation_pair_check
    check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null)),
  constraint inbox_thread_contacts_thread_workspace_fkey
    foreign key (thread_id, workspace_id)
    references public.inbox_threads(id, workspace_id) on delete cascade,
  constraint inbox_thread_contacts_contact_workspace_fkey
    foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id) on delete cascade,
  unique (id, workspace_id)
);

-- Un hilo no puede estar vinculado a dos contactos simultáneamente.
create unique index inbox_thread_contacts_one_active_thread_idx
  on public.inbox_thread_contacts(workspace_id, thread_id)
  where revoked_at is null;

create index inbox_thread_contacts_contact_idx
  on public.inbox_thread_contacts(workspace_id, contact_id)
  where revoked_at is null;

alter table public.inbox_thread_contacts enable row level security;
revoke all on table public.inbox_thread_contacts from anon, authenticated;
grant select on public.inbox_thread_contacts to authenticated;
grant insert (workspace_id, thread_id, contact_id, confirmed_by) on public.inbox_thread_contacts to authenticated;
grant update (revoked_at, revoked_by) on public.inbox_thread_contacts to authenticated;

-- La bandeja y sus asociaciones son visibles y gestionables solo por admins/owners.
create policy inbox_thread_contacts_select_admin
  on public.inbox_thread_contacts for select to authenticated
  using (private.has_role(workspace_id, 'admin'::workspace_role));

create policy inbox_thread_contacts_insert_admin
  on public.inbox_thread_contacts for insert to authenticated
  with check (
    private.has_role(workspace_id, 'admin'::workspace_role)
    and confirmed_by = (select auth.uid())
    and confirmed_at <= now()
    and revoked_at is null
    and revoked_by is null
  );

-- La desvinculación es un evento irreversible en el registro histórico.
-- No se concede DELETE ni permiso para modificar thread_id/contact_id.
create policy inbox_thread_contacts_revoke_admin
  on public.inbox_thread_contacts for update to authenticated
  using (
    private.has_role(workspace_id, 'admin'::workspace_role)
    and revoked_at is null
  )
  with check (
    private.has_role(workspace_id, 'admin'::workspace_role)
    and revoked_at is not null
    and revoked_by = (select auth.uid())
  );
