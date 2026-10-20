-- =============================================================================
-- Tests de la migración 3 (pgTAP): integración con Google y ejecuciones.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.dev', now());

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

-- A crea la organización; B es member; C es de otro espacio.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into t_ctx values ('org', public.create_organization('Estudio Planillas')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'member');
insert into t_ctx select 'c_personal', id::text from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000c1';

-- ---------------------------------------------------------------------------
-- 1. Refresh token en Vault
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
insert into t_ctx values ('int', public.integration_save((select v::uuid from t_ctx where k = 'org'), 'google',
  '1//refresh-token-de-prueba-0001', 'a@gmail.com', 'drive.file', '00000000-0000-0000-0000-0000000000a1')::text);
select is((select refresh_token from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'google')),
          '1//refresh-token-de-prueba-0001', 'service_role descifra el refresh token');
select is(public.integration_save((select v::uuid from t_ctx where k = 'org'), 'google',
          '1//refresh-token-de-prueba-0002', 'a@gmail.com', 'drive.file', '00000000-0000-0000-0000-0000000000a1')::text,
          (select v from t_ctx where k = 'int'), 'reconectar reutiliza la integración');
select pg_temp.logout();
select is((select count(*)::int from vault.secrets where name like 'integration:%'), 1, 'un solo secreto en Vault');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select account_email from public.integrations), 'a@gmail.com', 'un miembro ve la integración');
select throws_ok($$ select vault_secret_id from public.integrations $$, '42501', null, 'nadie lee la referencia al secreto');
select throws_ok($$ select * from public.integration_secret((select v::uuid from t_ctx where k = 'org'), 'google') $$,
                 '42501', null, 'un usuario no descifra el token');
select throws_ok($$ select 1 from public.oauth_states $$, '42501', null, 'oauth_states no es accesible');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.integrations $$, 'otro espacio no ve la integración');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 2. Planillas elegidas
-- ---------------------------------------------------------------------------
insert into public.integration_files (workspace_id, integration_id, provider_file_id, name)
values ((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'int'), '1AbCdEfGhIjKlMnOp', 'Ventas 2026');
select throws_ok($$ insert into public.integration_files (workspace_id, integration_id, provider_file_id, name)
                    values ((select v::uuid from t_ctx where k = 'c_personal'), (select v::uuid from t_ctx where k = 'int'), '1ZzZzZzZzZzZzZz', 'Cruzada') $$,
                 '23503', null, 'una planilla no cuelga de la integración de otro espacio');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select name from public.integration_files), 'Ventas 2026', 'un miembro ve las planillas elegidas');
select throws_ok($$ insert into public.integration_files (workspace_id, integration_id, provider_file_id, name)
                    values ((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'int'), '1YyYyYyYyYyYyYy', 'Mía') $$,
                 '42501', null, 'el cliente no añade planillas');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 3. Ejecuciones
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
with f as (
  insert into public.flows (workspace_id, name, definition, created_by)
  values ((select v::uuid from t_ctx where k = 'org'), 'Informe', '{"version":1,"steps":[]}', '00000000-0000-0000-0000-0000000000b1')
  returning id)
insert into t_ctx select 'flow', id::text from f;
select pg_temp.logout();

insert into public.flow_runs (id, workspace_id, flow_id, flow_name, plan, started_by, state) values
  ('22222222-2222-2222-2222-22222222222b', (select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'flow'),
   'Informe', '{"version":1}', '00000000-0000-0000-0000-0000000000b1', '{"items":[{"secreto":"datos de la planilla"}]}'),
  ('22222222-2222-2222-2222-22222222222a', (select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'flow'),
   'Informe', '{"version":1}', '00000000-0000-0000-0000-0000000000a1', '{"items":[]}');
insert into public.run_events (run_id, workspace_id, kind, title) values
  ('22222222-2222-2222-2222-22222222222b', (select v::uuid from t_ctx where k = 'org'), 'started', 'Inicio B'),
  ('22222222-2222-2222-2222-22222222222a', (select v::uuid from t_ctx where k = 'org'), 'started', 'Inicio A');

select throws_ok($$ insert into public.flow_runs (workspace_id, flow_id, flow_name, plan)
                    values ((select v::uuid from t_ctx where k = 'c_personal'), (select v::uuid from t_ctx where k = 'flow'), 'X', '{}') $$,
                 '23503', null, 'una ejecución no apunta a un flujo de otro espacio');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.flow_runs), 1, 'un member solo ve sus ejecuciones');
select is((select string_agg(title, ',') from public.run_events), 'Inicio B', 'un member solo ve sus eventos');
select throws_ok($$ select state from public.flow_runs $$, '42501', null, 'nadie lee la transcripción del agente');
select throws_ok($$ update public.flow_runs set status = 'succeeded' $$, '42501', null, 'el cliente no cambia una ejecución');
select throws_ok($$ insert into public.run_events (run_id, workspace_id, kind, title)
                    values ('22222222-2222-2222-2222-22222222222b', (select v::uuid from t_ctx where k = 'org'), 'approved', 'falso') $$,
                 '42501', null, 'el cliente no escribe eventos');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.flow_runs), 2, 'el owner ve todas las ejecuciones');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.flow_runs $$, 'otro espacio no ve ejecuciones');
select pg_temp.logout();

-- Borrar el flujo conserva el historial.
delete from public.flows where id = (select v::uuid from t_ctx where k = 'flow');
select is((select count(*)::int from public.flow_runs where flow_id is null and flow_name = 'Informe'), 2,
          'el historial sobrevive al borrado del flujo');

-- ---------------------------------------------------------------------------
-- 4. Desconectar borra el secreto y las planillas
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select ok(public.integration_delete((select v::uuid from t_ctx where k = 'org'), 'google', '00000000-0000-0000-0000-0000000000a1'),
          'service_role desconecta Google');
select pg_temp.logout();
select is((select count(*)::int from vault.secrets where name like 'integration:%'), 0, 'el secreto se borra de Vault');
select is((select count(*)::int from public.integration_files), 0, 'las planillas elegidas se borran');

-- Borrar el espacio no deja secretos huérfanos.
select pg_temp.as_service();
select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'google',
  '1//refresh-token-de-prueba-0003', 'a@gmail.com', 'drive.file', '00000000-0000-0000-0000-0000000000a1');
select pg_temp.logout();
delete from public.workspaces where id = (select v::uuid from t_ctx where k = 'org');
select is((select count(*)::int from vault.secrets where name like 'integration:%'), 0, 'borrar el espacio borra el secreto');

select * from finish();
rollback;
