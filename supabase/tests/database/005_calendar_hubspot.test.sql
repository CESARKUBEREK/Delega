-- =============================================================================
-- Tests de la migración 5 (pgTAP): Google Calendar y HubSpot.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a5', 'a5@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b5', 'b5@test.dev', now());

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
insert into t_ctx values ('org', public.create_organization('Estudio CRM')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b5', 'member');

select pg_temp.as_service();
select lives_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'calendar', '1//refresh-calendar-000',
                  'a5@gmail.com', 'calendar.events', '00000000-0000-0000-0000-0000000000a5') $$,
                'se guarda una conexión de Calendar');
select lives_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'hubspot', 'pat-eu1-00000000-test',
                  'Portal 123', '', '00000000-0000-0000-0000-0000000000a5') $$,
                'se guarda una conexión de HubSpot');
select is((select refresh_token from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'hubspot')),
          'pat-eu1-00000000-test', 'service_role lee la clave de HubSpot');
select lives_ok($$ insert into public.oauth_states (state_hash, workspace_id, user_id, provider, code_verifier, redirect_uri)
                   values (repeat('a', 64), (select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000a5',
                           'calendar', repeat('v', 43), 'https://delega-five.vercel.app/integraciones/google/callback') $$,
                'oauth_states admite calendar');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b5');
select is((select account_email from public.integrations where provider = 'hubspot'), 'Portal 123',
          'un miembro ve la cuenta conectada');
select throws_ok($$ select * from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'hubspot') $$,
                 '42501', null, 'un usuario no lee la clave de HubSpot');
select pg_temp.logout();

select * from finish();
rollback;
