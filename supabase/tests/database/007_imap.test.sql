-- =============================================================================
-- Tests de la migración 7 (pgTAP): correo IMAP/SMTP.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.dev', now());

create temp table t_ctx (k text primary key, v text);
grant select, insert, update on t_ctx to authenticated, service_role;

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
insert into t_ctx values ('org', public.create_organization('Estudio Correo')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b7', 'member');

select pg_temp.as_service();
select lives_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'imap',
                  '{"user":"ana@estudio.test","password":"secreto123"}', 'ana@estudio.test', '',
                  '00000000-0000-0000-0000-0000000000a7') $$,
                'se guarda una conexión IMAP');
select is((select refresh_token from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'imap')),
          '{"user":"ana@estudio.test","password":"secreto123"}', 'service_role lee las credenciales');
select is((select count(*)::int from public.mail_integrations_due(10) where provider = 'imap'), 1,
          'la lectura automática ve el buzón activo');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b7');
select is((select account_email from public.integrations where provider = 'imap'), 'ana@estudio.test',
          'un miembro ve la dirección conectada');
select throws_ok($$ select * from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'imap') $$,
                 '42501', null, 'un usuario no lee las credenciales');
select throws_ok($$ select * from public.mail_integrations_due(10) $$,
                 '42501', null, 'un usuario no lista los buzones para la lectura automática');
select pg_temp.logout();

select throws_ok($$ insert into public.integrations (workspace_id, provider, vault_secret_id)
                    values ((select v::uuid from t_ctx where k = 'org'), 'pop3', gen_random_uuid()) $$,
                 '23514', null, 'solo se admiten los proveedores conocidos');

select * from finish();
rollback;
