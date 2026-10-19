-- =============================================================================
-- Tests de la migración 2 (pgTAP): BYOK en Vault, asistente, flujos, consumo.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

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

-- A crea la organización; B entra como member (alta directa para el test).
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into t_ctx values ('org', public.create_organization('Estudio IA')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'member');
insert into t_ctx select 'c_personal', id::text from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000c1';

-- ---------------------------------------------------------------------------
-- 1. Clave en Vault
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select is((select key_hint from public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'openai',
           'sk-test-0000000000000000000000000000abcd', 'gpt-6.1-sol', '00000000-0000-0000-0000-0000000000a1')),
          '…abcd', 'service_role guarda la clave y solo devuelve la pista');
select is((select api_key from public.ai_connection_secret((select v::uuid from t_ctx where k = 'org'), 'openai')),
          'sk-test-0000000000000000000000000000abcd', 'service_role puede descifrar la clave');
select pg_temp.logout();

select is((select count(*)::int from public.ai_connections where key_hint = '…abcd'), 1, 'la tabla solo guarda la pista');
select is((select count(*)::int from public.ai_connections c join vault.secrets s on s.id = c.vault_secret_id), 1, 'el secreto está en Vault');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select key_hint from public.ai_connections), '…abcd', 'un miembro ve el estado y la pista');
select throws_ok($$ select vault_secret_id from public.ai_connections $$, '42501', null, 'nadie lee la referencia al secreto');
select throws_ok($$ select * from public.ai_connection_secret((select v::uuid from t_ctx where k = 'org'), 'openai') $$,
                 '42501', null, 'un usuario no puede descifrar la clave');
select throws_ok($$ select * from public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'openai',
                    'sk-test-1111111111111111111111111111zzzz', 'gpt-6-luna', '00000000-0000-0000-0000-0000000000b1') $$,
                 '42501', null, 'un usuario no puede guardar claves directamente');
select throws_ok($$ select vault.create_secret('x') $$, '42501', null, 'un usuario no accede a Vault');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.ai_connections $$, 'otro espacio no ve la conexión');
select pg_temp.logout();

set local role anon;
select throws_ok($$ select * from public.ai_connections $$, '42501', null, 'anon no ve conexiones');
reset role;

-- Guardar de nuevo reutiliza el mismo secreto (no deja claves huérfanas).
select pg_temp.as_service();
select is((select key_hint from public.ai_connection_save((select v::uuid from t_ctx where k = 'org'), 'openai',
           'sk-test-2222222222222222222222222222wxyz', 'gpt-6-luna', '00000000-0000-0000-0000-0000000000a1')),
          '…wxyz', 'sustituir la clave');
select pg_temp.logout();
select is((select count(*)::int from vault.secrets), 1, 'sigue habiendo un solo secreto');

-- ---------------------------------------------------------------------------
-- 2. Conversaciones y mensajes (los escribe service_role)
-- ---------------------------------------------------------------------------
insert into public.conversations (id, workspace_id, created_by, title) values
  ('11111111-1111-1111-1111-11111111111a', (select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000a1', 'De A'),
  ('11111111-1111-1111-1111-11111111111b', (select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'De B');
insert into public.messages (conversation_id, workspace_id, role, content, created_by) values
  ('11111111-1111-1111-1111-11111111111a', (select v::uuid from t_ctx where k = 'org'), 'user', 'hola A', '00000000-0000-0000-0000-0000000000a1'),
  ('11111111-1111-1111-1111-11111111111b', (select v::uuid from t_ctx where k = 'org'), 'user', 'hola B', '00000000-0000-0000-0000-0000000000b1');
insert into t_ctx select 'msg_b', id::text from public.messages where content = 'hola B';

select throws_ok($$ insert into public.messages (conversation_id, workspace_id, role, content)
                    values ('11111111-1111-1111-1111-11111111111a', (select v::uuid from t_ctx where k = 'c_personal'), 'user', 'cruzado') $$,
                 '23503', null, 'un mensaje no puede colgar de una conversación de otro espacio');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.conversations), 1, 'un member solo ve sus conversaciones');
select is((select string_agg(content, ',') from public.messages), 'hola B', 'un member solo ve sus mensajes');
select throws_ok($$ insert into public.messages (conversation_id, workspace_id, role, content)
                    values ('11111111-1111-1111-1111-11111111111b', (select v::uuid from t_ctx where k = 'org'), 'assistant', 'falso') $$,
                 '42501', null, 'el cliente no escribe mensajes');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.conversations), 2, 'el owner ve todas las conversaciones del espacio');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.messages $$, 'otro espacio no ve mensajes');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 3. Flujos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
with f as (
  insert into public.flows (workspace_id, name, definition, created_by, source_message_id)
  values ((select v::uuid from t_ctx where k = 'org'), 'Informe de ventas', '{"version":1,"steps":[]}',
          '00000000-0000-0000-0000-0000000000b1', (select v::bigint from t_ctx where k = 'msg_b'))
  returning id)
insert into t_ctx select 'flow_b', id::text from f;
select isnt_empty($$ select 1 from public.flows where id = (select v::uuid from t_ctx where k = 'flow_b') $$, 'un member crea un borrador');
select throws_ok($$ insert into public.flows (workspace_id, name, definition, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Suplantado', '{}', '00000000-0000-0000-0000-0000000000a1') $$,
                 '42501', null, 'no se crea un flujo a nombre de otro');
select throws_ok($$ insert into public.flows (workspace_id, name, definition, created_by, status)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Activo', '{}', '00000000-0000-0000-0000-0000000000b1', 'active') $$,
                 '42501', null, 'un flujo nuevo nace como borrador');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ insert into public.flows (workspace_id, name, definition, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Intruso', '{}', '00000000-0000-0000-0000-0000000000c1') $$,
                 '42501', null, 'otro espacio no crea flujos aquí');
select is_empty($$ update public.flows set name = 'x' returning id $$, 'otro espacio no edita flujos');
select throws_ok($$ insert into public.flows (workspace_id, name, definition, created_by, source_message_id)
                    values ((select v::uuid from t_ctx where k = 'c_personal'), 'Robo', '{}', '00000000-0000-0000-0000-0000000000c1',
                            (select v::bigint from t_ctx where k = 'msg_b')) $$,
                 '23503', null, 'no se enlaza un mensaje de otro espacio');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select isnt_empty($$ update public.flows set name = 'Informe mensual' where id = (select v::uuid from t_ctx where k = 'flow_b') returning id $$,
                  'el owner edita el flujo de un member');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 4. Consumo
-- ---------------------------------------------------------------------------
insert into public.usage_events (workspace_id, provider, model, input_tokens, output_tokens, created_by) values
  ((select v::uuid from t_ctx where k = 'org'), 'openai', 'gpt-6-luna', 100, 50, '00000000-0000-0000-0000-0000000000a1'),
  ((select v::uuid from t_ctx where k = 'org'), 'openai', 'gpt-6-luna', 10, 5, '00000000-0000-0000-0000-0000000000b1');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select sum(input_tokens)::int from public.usage_events), 10, 'un member solo ve su consumo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 5. Borrado: la clave desaparece de Vault
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select ok(public.ai_connection_delete((select v::uuid from t_ctx where k = 'org'), 'openai', '00000000-0000-0000-0000-0000000000a1'),
          'service_role borra la conexión');
select pg_temp.logout();
select is((select count(*)::int from vault.secrets), 0, 'el secreto se borra de Vault');

select * from finish();
rollback;
