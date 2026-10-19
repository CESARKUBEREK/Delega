-- =============================================================================
-- Delega · Migración 1 · Núcleo de identidad y multiempresa
-- -----------------------------------------------------------------------------
-- Crea: profiles, workspaces (personal | organization), memberships,
--       invitations, audit_log; funciones auxiliares en el esquema private;
--       RPCs create_organization / create_invitation / accept_invitation;
--       trigger de alta sobre auth.users (perfil + espacio personal + owner).
--
-- Principios:
--   * Todo dato de negocio pertenece a un workspace (workspace_id NOT NULL).
--   * La interfaz nunca decide permisos: RLS + funciones en el servidor.
--   * Las funciones SECURITY DEFINER fijan search_path = '' y califican todo.
--   * El esquema private no está expuesto por la API (PostgREST).
--   * anon no tiene acceso a ninguna tabla de este módulo.
--   * Sin contraseñas ni secretos en tablas propias (Supabase Auth / Vault).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Esquema privado y tipos
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
-- authenticated necesita USAGE para que las políticas RLS puedan llamar a las
-- funciones auxiliares. El esquema no se publica en la API, así que no son
-- invocables por HTTP.
grant usage on schema private to authenticated, service_role;

create type public.workspace_kind as enum ('personal', 'organization');
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.membership_status as enum ('active', 'suspended');

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

-- 1.1 Perfiles: 1:1 con auth.users. Solo datos de presentación.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) <= 120),
  avatar_url    text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  locale        text not null default 'es' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'Perfil de presentación de cada usuario (1:1 con auth.users). Sin datos de autorización.';

-- 1.2 Espacios de trabajo: personal (uno por usuario) u organización.
create table public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  kind            public.workspace_kind not null,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  -- Dueño del espacio personal; NULL en organizaciones.
  personal_owner  uuid unique references auth.users (id) on delete cascade,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint workspaces_personal_owner_chk
    check ((kind = 'personal') = (personal_owner is not null))
);
create index workspaces_created_by_idx on public.workspaces (created_by);
comment on table public.workspaces is 'Espacio de trabajo: personal (uno por usuario, sin más miembros) u organización (varios miembros con rol).';

-- 1.3 Membresías: N:M usuarios ↔ espacios, con un rol por espacio.
create table public.memberships (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.workspace_role not null,
  status        public.membership_status not null default 'active',
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_invited_by_idx on public.memberships (invited_by);
comment on table public.memberships is 'Pertenencia de un usuario a un espacio. Única fuente de verdad de autorización.';

-- 1.4 Invitaciones: el token en claro solo se devuelve una vez; se guarda su hash.
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 320),
  role          public.workspace_role not null default 'member' check (role <> 'owner'),
  token_hash    bytea not null unique,
  invited_by    uuid references auth.users (id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users (id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create unique index invitations_one_pending_per_email
  on public.invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;
create index invitations_invited_by_idx on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);
comment on table public.invitations is 'Invitaciones a organizaciones. Token aleatorio de 256 bits guardado como SHA-256; caduca a los 7 días; un solo uso.';

-- 1.5 Registro de auditoría (append-only).
create table public.audit_log (
  id            bigint generated always as identity primary key,
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null check (char_length(action) <= 100),
  target_type   text check (char_length(target_type) <= 50),
  target_id     text check (char_length(target_id) <= 200),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_workspace_created_idx on public.audit_log (workspace_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
comment on table public.audit_log is 'Auditoría append-only. Solo escriben funciones del servidor; nadie actualiza ni borra desde el cliente.';

-- -----------------------------------------------------------------------------
-- 2. Funciones auxiliares (esquema private)
-- -----------------------------------------------------------------------------

create function private.role_rank(p_role public.workspace_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role when 'owner' then 3 when 'admin' then 2 when 'member' then 1 end;
$$;

-- ¿El usuario actual es miembro activo del espacio?
create function private.is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- ¿El usuario actual tiene, como mínimo, el rol indicado en el espacio?
create function private.has_role(p_workspace_id uuid, p_min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and private.role_rank(m.role) >= private.role_rank(p_min_role)
  );
$$;

-- ¿El usuario actual comparte algún espacio activo con otro usuario?
create function private.shares_workspace(p_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships other
      on other.workspace_id = me.workspace_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_other_user
      and other.status = 'active'
  );
$$;

-- ¿La sesión actual superó el segundo factor (MFA)? Para acciones sensibles
-- futuras (claves API, cambios de rol, borrado de espacios).
create function private.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- Escritura de auditoría (solo desde funciones del servidor).
create function private.audit(
  p_workspace_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (p_workspace_id, (select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.role_rank(public.workspace_role)              to authenticated, service_role;
grant execute on function private.is_member(uuid)                               to authenticated, service_role;
grant execute on function private.has_role(uuid, public.workspace_role)         to authenticated, service_role;
grant execute on function private.shares_workspace(uuid)                        to authenticated, service_role;
grant execute on function private.is_aal2()                                     to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Reglas de integridad de membresías (triggers)
-- -----------------------------------------------------------------------------
-- Las políticas RLS dicen QUIÉN puede tocar una fila; este trigger impone
-- invariantes que ninguna política puede expresar sola:
--   * un espacio personal tiene exactamente un miembro (su dueño, owner);
--   * solo un owner puede dar, quitar o tocar el rol owner;
--   * nunca queda una organización sin owner activo.
create function private.enforce_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor       uuid := (select auth.uid());
  v_ws_id       uuid := coalesce(new.workspace_id, old.workspace_id);
  v_kind        public.workspace_kind;
  v_owner       uuid;
  v_actor_owner boolean;
  v_other_owners int;
begin
  select w.kind, w.personal_owner into v_kind, v_owner
  from public.workspaces w
  where w.id = v_ws_id;

  -- Borrado en cascada (se está eliminando el espacio o el usuario): permitir.
  if tg_op = 'DELETE' then
    if v_kind is null
       or not exists (select 1 from auth.users u where u.id = old.user_id) then
      return old;
    end if;
  end if;

  -- Espacio personal: solo su dueño, como owner, y no se modifica.
  if v_kind = 'personal' then
    if tg_op = 'INSERT' and new.user_id = v_owner and new.role = 'owner' and new.status = 'active' then
      return new;
    end if;
    raise exception 'Un espacio personal no admite cambios de miembros'
      using errcode = '42501';
  end if;

  -- Identidad del autor (NULL = proceso del servidor, p. ej. service_role).
  v_actor_owner := v_actor is not null and exists (
    select 1 from public.memberships m
    where m.workspace_id = v_ws_id and m.user_id = v_actor
      and m.role = 'owner' and m.status = 'active'
  );

  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
      raise exception 'No se puede mover una membresía' using errcode = '42501';
    end if;
    if v_actor is not null and not v_actor_owner
       and (old.role = 'owner' or new.role = 'owner') then
      raise exception 'Solo un owner puede gestionar el rol owner' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' and v_actor is not null and v_actor <> old.user_id
     and not v_actor_owner and old.role = 'owner' then
    raise exception 'Solo un owner puede retirar a otro owner' using errcode = '42501';
  end if;

  -- Último owner activo: no se degrada, suspende ni elimina.
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into v_other_owners
    from public.memberships m
    where m.workspace_id = v_ws_id and m.user_id <> old.user_id
      and m.role = 'owner' and m.status = 'active';
    if v_other_owners = 0 then
      raise exception 'La organización debe conservar al menos un owner activo'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_enforce_rules
  before insert or update or delete on public.memberships
  for each row execute function private.enforce_membership_rules();

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Si el espacio ya no existe (borrado en cascada), no se audita aquí.
  if not exists (select 1 from public.workspaces w where w.id = coalesce(new.workspace_id, old.workspace_id)) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform private.audit(new.workspace_id, 'membership.added', 'user', new.user_id::text,
      jsonb_build_object('role', new.role));
  elsif tg_op = 'UPDATE' then
    perform private.audit(new.workspace_id, 'membership.updated', 'user', new.user_id::text,
      jsonb_build_object('from', jsonb_build_object('role', old.role, 'status', old.status),
                         'to',   jsonb_build_object('role', new.role, 'status', new.status)));
  else
    perform private.audit(old.workspace_id, 'membership.removed', 'user', old.user_id::text,
      jsonb_build_object('role', old.role));
  end if;
  return null;
end;
$$;

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_membership_change();

create trigger profiles_set_updated_at    before update on public.profiles    for each row execute function private.set_updated_at();
create trigger workspaces_set_updated_at  before update on public.workspaces  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Alta de usuario: perfil + espacio personal + membresía owner
-- -----------------------------------------------------------------------------
-- raw_user_meta_data lo controla el propio usuario: solo se usa para el nombre
-- visible, nunca para autorizar.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws_id uuid;
  v_name  text;
begin
  v_name := left(btrim(coalesce(
              nullif(new.raw_user_meta_data ->> 'full_name', ''),
              nullif(new.raw_user_meta_data ->> 'name', ''),
              split_part(coalesce(new.email, ''), '@', 1))), 120);

  insert into public.profiles (id, display_name)
  values (new.id, nullif(v_name, ''));

  insert into public.workspaces (kind, name, personal_owner, created_by)
  values ('personal', 'Espacio personal', new.id, new.id)
  returning id into v_ws_id;

  insert into public.memberships (workspace_id, user_id, role, status)
  values (v_ws_id, new.id, 'owner', 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on function private.enforce_membership_rules() from public, anon, authenticated;
revoke all on function private.audit_membership_change()  from public, anon, authenticated;
revoke all on function private.handle_new_user()          from public, anon, authenticated;
revoke all on function private.audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.set_updated_at()           from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPCs públicas (operaciones con lógica que no cabe en una política)
-- -----------------------------------------------------------------------------

-- 5.1 Crear una organización; quien la crea queda como owner.
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_name  text := btrim(coalesce(p_name, ''));
  v_ws_id uuid;
begin
  if v_uid is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'El nombre debe tener entre 1 y 120 caracteres' using errcode = '22023';
  end if;
  -- Límite anti-abuso: 20 organizaciones creadas por usuario.
  if (select count(*) from public.workspaces w
      where w.created_by = v_uid and w.kind = 'organization') >= 20 then
    raise exception 'Has alcanzado el límite de organizaciones' using errcode = '54000';
  end if;

  insert into public.workspaces (kind, name, created_by)
  values ('organization', v_name, v_uid)
  returning id into v_ws_id;

  insert into public.memberships (workspace_id, user_id, role, status)
  values (v_ws_id, v_uid, 'owner', 'active');

  perform private.audit(v_ws_id, 'workspace.created', 'workspace', v_ws_id::text, '{}'::jsonb);
  return v_ws_id;
end;
$$;

-- 5.2 Crear una invitación. Devuelve el token en claro UNA sola vez; el envío
--     del correo lo hará una Edge Function (fase siguiente).
create function public.create_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role default 'member'
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id    uuid;
  v_exp   timestamptz;
begin
  if v_uid is null or not private.has_role(p_workspace_id, 'admin') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspaces w
                 where w.id = p_workspace_id and w.kind = 'organization') then
    raise exception 'Solo se puede invitar a organizaciones' using errcode = '22023';
  end if;
  if p_role is null or p_role = 'owner' then
    raise exception 'Rol de invitación no válido' using errcode = '22023';
  end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
             where m.workspace_id = p_workspace_id and lower(u.email) = v_email) then
    raise exception 'Esa persona ya es miembro' using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitations (workspace_id, email, role, token_hash, invited_by)
  values (p_workspace_id, v_email, p_role, sha256(convert_to(v_token, 'UTF8')), v_uid)
  returning id, invitations.expires_at into v_id, v_exp;

  perform private.audit(p_workspace_id, 'invitation.created', 'invitation', v_id::text,
                        jsonb_build_object('email', v_email, 'role', p_role));

  return query select v_id, v_token, v_exp;
end;
$$;

-- 5.3 Aceptar una invitación. Requiere sesión con el MISMO correo invitado y
--     correo verificado. El mensaje de error es genérico para no revelar si
--     un token existe.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_inv   public.invitations%rowtype;
  v_email text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitación no válida o caducada' using errcode = '22023';
  end if;

  select * into v_inv
  from public.invitations i
  where i.token_hash = sha256(convert_to(p_token, 'UTF8'))
  for update;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or v_confirmed is null
     or v_email is distinct from v_inv.email then
    raise exception 'Invitación no válida o caducada' using errcode = '22023';
  end if;

  insert into public.memberships (workspace_id, user_id, role, status, invited_by)
  values (v_inv.workspace_id, v_uid, v_inv.role, 'active', v_inv.invited_by)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  perform private.audit(v_inv.workspace_id, 'invitation.accepted', 'invitation', v_inv.id::text, '{}'::jsonb);
  return v_inv.workspace_id;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.create_invitation(uuid, text, public.workspace_role) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workspace_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Privilegios de tabla (mínimos) y RLS
-- -----------------------------------------------------------------------------
-- Supabase concede por defecto ALL a anon y authenticated en public: se retira
-- y se concede solo lo necesario, columna a columna donde aplica.
revoke all on table public.profiles, public.workspaces, public.memberships,
                    public.invitations, public.audit_log
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, locale) on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;

grant select on public.memberships to authenticated;
grant update (role, status) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

-- token_hash nunca se expone al cliente.
grant select (id, workspace_id, email, role, invited_by, expires_at,
              accepted_at, accepted_by, revoked_at, created_at)
  on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

grant select on public.audit_log to authenticated;

alter table public.profiles    enable row level security;
alter table public.workspaces  enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log   enable row level security;

-- profiles: el propio perfil y los de quienes comparten espacio contigo.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- workspaces: visibles para sus miembros activos.
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (private.is_member(id));

create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (private.has_role(id, 'admin'))
  with check (private.has_role(id, 'admin'));

-- Solo el owner borra una organización; el espacio personal no se borra aquí
-- (se elimina con la cuenta).
create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated
  using (kind = 'organization' and private.has_role(id, 'owner'));

-- memberships: los miembros ven la lista del espacio; cada uno ve la suya.
create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(workspace_id));

-- Altas solo por RPC (create_organization / accept_invitation): sin política INSERT.

create policy memberships_update_admin on public.memberships
  for update to authenticated
  using (private.has_role(workspace_id, 'admin'))
  with check (private.has_role(workspace_id, 'admin'));

-- Un admin retira miembros; cualquiera puede abandonar un espacio.
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_role(workspace_id, 'admin'));

-- invitations: gestionadas por admins y owners.
create policy invitations_select_admin on public.invitations
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));

create policy invitations_revoke_admin on public.invitations
  for update to authenticated
  using (private.has_role(workspace_id, 'admin') and accepted_at is null)
  with check (private.has_role(workspace_id, 'admin'));

-- audit_log: lectura para admins y owners del espacio; sin escritura cliente.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (workspace_id is not null and private.has_role(workspace_id, 'admin'));
