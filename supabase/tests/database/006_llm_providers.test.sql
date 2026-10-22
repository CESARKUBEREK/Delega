-- =============================================================================
-- Tests de la migración 6 (pgTAP): varios proveedores de IA.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@test.dev', now());

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
insert into t_ctx values ('org', public.create_organization('Estudio LLM')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b6', 'member');

select pg_temp.as_service();
select lives_ok($$ select public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'anthropic',
                  'sk-ant-api03-000000000000000000000000', 'claude-sonnet-5-5', '00000000-0000-0000-0000-0000000000a6') $$,
                'se guarda una clave de Anthropic');
select is(public.ai_connection_ensure_default((select v::uuid from t_ctx where k = 'org')), 'anthropic',
          'la primera conexión pasa a ser la de por defecto');
select lives_ok($$ select public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'deepseek',
                  'sk-00000000000000000000000000000000', 'deepseek-flash', '00000000-0000-0000-0000-0000000000a6') $$,
                'se guarda una clave de DeepSeek');
select is(public.ai_connection_ensure_default((select v::uuid from t_ctx where k = 'org')), 'anthropic',
          'una segunda conexión no cambia la de por defecto');
select ok(public.ai_connection_set_default((select v::uuid from t_ctx where k = 'org'), 'deepseek', '00000000-0000-0000-0000-0000000000a6'),
          'se elige DeepSeek como proveedor por defecto');
select is((select count(*)::int from public.ai_connections where workspace_id = (select v::uuid from t_ctx where k = 'org') and is_default), 1,
          'solo hay un proveedor por defecto');
select ok(not public.ai_connection_set_default((select v::uuid from t_ctx where k = 'org'), 'kimi', '00000000-0000-0000-0000-0000000000a6'),
          'no se puede elegir un proveedor sin conectar');
select throws_ok($$ update public.ai_connections set provider = 'mistral'
                    where workspace_id = (select v::uuid from t_ctx where k = 'org') and provider = 'anthropic' $$,
                 '23514', null, 'un proveedor desconocido no se admite');
select lives_ok($$ select public.ai_connection_delete((select v::uuid from t_ctx where k = 'org'), 'deepseek', '00000000-0000-0000-0000-0000000000a6') $$,
                'se desconecta el proveedor por defecto');
select is(public.ai_connection_ensure_default((select v::uuid from t_ctx where k = 'org')), 'anthropic',
          'al borrar el de por defecto, otro ocupa su lugar');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b6');
select is((select provider from public.ai_connections where is_default), 'anthropic',
          'un miembro ve cuál es el proveedor por defecto');
select throws_ok($$ select public.ai_connection_set_default((select v::uuid from t_ctx where k = 'org'), 'anthropic', '00000000-0000-0000-0000-0000000000b6') $$,
                 '42501', null, 'un usuario no puede cambiar el proveedor por defecto directamente');
select pg_temp.logout();

select * from finish();
rollback;
