-- =============================================================================
-- Tests de aislamiento entre espacios (pgTAP). Ejecutar con: supabase test db
-- Cada prueba corre dentro de una transacción que se deshace al final.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- ---------------------------------------------------------------------------
-- Datos de prueba: tres usuarios (A y B verificados, C sin verificar)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', now(), '{"full_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', now(), '{"full_name":"Beto"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev', null,  '{}');

create temp table t_ctx (k text primary key, v text);
grant select, insert, update on t_ctx to authenticated;

-- Atajos para actuar como un usuario autenticado o como anónimo.
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Alta: perfil + espacio personal + owner
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles), 3, 'el alta crea un perfil por usuario');
select is((select count(*)::int from public.workspaces where kind = 'personal'), 3, 'el alta crea un espacio personal por usuario');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Ana', 'el nombre visible sale de los metadatos');
select is((select role::text from public.memberships m join public.workspaces w on w.id = m.workspace_id
           where w.personal_owner = '00000000-0000-0000-0000-00000000000a'), 'owner', 'el usuario es owner de su espacio personal');

-- ---------------------------------------------------------------------------
-- 2. A crea una organización
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into t_ctx values ('org_a', public.create_organization('Estudio A')::text);
select is((select count(*)::int from public.workspaces), 2, 'A ve su espacio personal y su organización');
select throws_ok($$ select public.create_organization('   ') $$, '22023', null, 'nombre vacío rechazado');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 3. Aislamiento: B no ve ni toca nada de A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.workspaces), 1, 'B solo ve su espacio personal');
select is_empty($$ select 1 from public.workspaces where id = (select v::uuid from t_ctx where k = 'org_a') $$, 'B no ve la organización de A');
select is_empty($$ select 1 from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' $$, 'B no ve membresías de A');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$, 'B no ve el perfil de A');
select is_empty($$ update public.workspaces set name = 'hackeado' where id = (select v::uuid from t_ctx where k = 'org_a') returning id $$, 'B no puede renombrar la organización de A');
select is_empty($$ delete from public.memberships where workspace_id = (select v::uuid from t_ctx where k = 'org_a') returning user_id $$, 'B no puede borrar membresías de A');
select is_empty($$ delete from public.workspaces where id = (select v::uuid from t_ctx where k = 'org_a') returning id $$, 'B no puede borrar la organización de A');
select throws_ok($$ insert into public.memberships (workspace_id, user_id, role)
                    values ((select v::uuid from t_ctx where k = 'org_a'), '00000000-0000-0000-0000-00000000000b', 'owner') $$,
                 '42501', null, 'B no puede autoinsertarse en la organización de A');
select throws_ok($$ select * from public.create_invitation((select v::uuid from t_ctx where k = 'org_a'), 'x@test.dev') $$,
                 '42501', null, 'B no puede invitar a la organización de A');
select throws_ok($$ insert into public.audit_log (action) values ('falso') $$, '42501', null, 'el cliente no escribe en la auditoría');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 4. Anónimo: sin acceso a nada
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.workspaces $$, '42501', null, 'anon no lee espacios');
select throws_ok($$ select public.create_organization('x') $$, '42501', null, 'anon no ejecuta RPCs');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Invitaciones
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into t_ctx select 'tok_b', token from public.create_invitation((select v::uuid from t_ctx where k = 'org_a'), 'B@Test.dev ', 'member');
insert into t_ctx select 'tok_c', token from public.create_invitation((select v::uuid from t_ctx where k = 'org_a'), 'c@test.dev', 'member');
select throws_ok($$ select * from public.create_invitation((select v::uuid from t_ctx where k = 'org_a'), 'z@test.dev', 'owner') $$,
                 '22023', null, 'no se invita como owner');
select throws_ok($$ select token_hash from public.invitations $$, '42501', null, 'el hash del token no es legible');
select throws_ok($$ select * from public.create_invitation((select id from public.workspaces where kind = 'personal'), 'b@test.dev') $$,
                 '22023', null, 'no se invita a un espacio personal');
select pg_temp.logout();

-- C (correo sin verificar) no puede aceptar ni su propia invitación ni la de B.
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.accept_invitation((select v from t_ctx where k = 'tok_c')) $$, '22023', null, 'correo sin verificar: no acepta');
select throws_ok($$ select public.accept_invitation((select v from t_ctx where k = 'tok_b')) $$, '22023', null, 'no se acepta la invitación de otro correo');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.accept_invitation(repeat('0', 64)) $$, '22023', null, 'token inexistente rechazado');
select is(public.accept_invitation((select v from t_ctx where k = 'tok_b'))::text, (select v from t_ctx where k = 'org_a'), 'B acepta su invitación');
select throws_ok($$ select public.accept_invitation((select v from t_ctx where k = 'tok_b')) $$, '22023', null, 'el token es de un solo uso');
select is((select count(*)::int from public.workspaces), 2, 'B ya ve la organización');
select isnt_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$, 'B ve el perfil de A al compartir espacio');
select is_empty($$ update public.memberships set role = 'admin'
                   where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000b' returning role $$,
                'un member no se asciende');
select throws_ok($$ update public.memberships m set role = 'admin' from public.workspaces w
                    where w.id = m.workspace_id and w.kind = 'personal' and m.user_id = '00000000-0000-0000-0000-00000000000b' $$,
                 '42501', null, 'la membresía del espacio personal no se modifica');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 6. Roles: escalada y último owner
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.memberships set role = 'admin'
 where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000b';
select throws_ok($$ update public.memberships set role = 'member'
                    where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000a' $$,
                 '42501', null, 'el último owner no se degrada');
select throws_ok($$ delete from public.memberships
                    where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000a' $$,
                 '42501', null, 'el último owner no abandona la organización');
select throws_ok($$ delete from public.memberships m using public.workspaces w
                    where w.id = m.workspace_id and w.kind = 'personal' and m.user_id = '00000000-0000-0000-0000-00000000000a' $$,
                 '42501', null, 'no se abandona el espacio personal');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ update public.memberships set role = 'member'
                    where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000a' $$,
                 '42501', null, 'un admin no degrada a un owner');
select throws_ok($$ update public.memberships set role = 'owner'
                    where workspace_id = (select v::uuid from t_ctx where k = 'org_a') and user_id = '00000000-0000-0000-0000-00000000000b' $$,
                 '42501', null, 'un admin no se hace owner');
select isnt_empty($$ select 1 from public.audit_log where workspace_id = (select v::uuid from t_ctx where k = 'org_a') $$, 'un admin lee la auditoría');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 7. Borrados en cascada
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select isnt_empty($$ delete from public.workspaces where id = (select v::uuid from t_ctx where k = 'org_a') returning id $$, 'el owner borra su organización');
select pg_temp.logout();
select is((select count(*)::int from public.memberships where workspace_id = (select v::uuid from t_ctx where k = 'org_a')), 0, 'las membresías se borran con la organización');

delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select is((select count(*)::int from public.workspaces where personal_owner = '00000000-0000-0000-0000-00000000000c'), 0, 'borrar la cuenta borra su espacio personal');

select * from finish();
rollback;
