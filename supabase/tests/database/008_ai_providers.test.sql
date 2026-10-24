-- =============================================================================
-- Tests de la migración 8 (pgTAP): varias IAs y retirada de Gmail.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.dev', now());

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
insert into t_ctx values ('org', public.create_organization('Estudio IA')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b8', 'member');

select pg_temp.as_service();
select public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'anthropic', 'sk-ant-api03-prueba-0000000000', 'claude-sonnet-5-5', '00000000-0000-0000-0000-0000000000a8');
select public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'deepseek', 'sk-deepseek-prueba-000000000000', 'deepseek-flash', '00000000-0000-0000-0000-0000000000a8');
select is((select provider from public.ai_connections where workspace_id = (select v::uuid from t_ctx where k = 'org') and is_default),
          'anthropic', 'la primera conexión es la principal');
select is((select count(*)::int from public.ai_connections where workspace_id = (select v::uuid from t_ctx where k = 'org')), 2,
          'Anthropic y DeepSeek conviven');
select ok(public.ai_connection_set_default((select v::uuid from t_ctx where k = 'org'), 'deepseek'), 'se cambia la principal');
select is((select string_agg(provider, ',') from public.ai_connections where workspace_id = (select v::uuid from t_ctx where k = 'org') and is_default),
          'deepseek', 'solo hay una principal');
select public.ai_connection_delete((select v::uuid from t_ctx where k = 'org'), 'deepseek', '00000000-0000-0000-0000-0000000000a8');
select is((select provider from public.ai_connections where workspace_id = (select v::uuid from t_ctx where k = 'org') and is_default),
          'anthropic', 'al borrar la principal, pasa a serlo otra');
select throws_ok($$ select public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'mistral', 'clave-de-prueba-0000000000000', 'm', null) $$,
                 '23514', null, 'solo se admiten los proveedores conocidos');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select is((select is_default from public.ai_connections where provider = 'anthropic'), true, 'un miembro ve cuál es la principal');
select throws_ok($$ select public.ai_connection_set_default((select v::uuid from t_ctx where k = 'org'), 'anthropic') $$,
                 '42501', null, 'un usuario no cambia la principal directamente');
select pg_temp.logout();

select throws_ok($$ insert into public.integrations (workspace_id, provider, vault_secret_id)
                    values ((select v::uuid from t_ctx where k = 'org'), 'gmail', gen_random_uuid()) $$,
                 '23514', null, 'ya no se admiten conexiones de Gmail por OAuth');

select * from finish();
rollback;
