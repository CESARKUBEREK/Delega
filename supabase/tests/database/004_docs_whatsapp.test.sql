-- =============================================================================
-- Tests de la migración 4 (pgTAP): WhatsApp, contactos y disparadores.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into t_ctx values ('org', public.create_organization('Estudio WhatsApp')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'member');

-- ---------------------------------------------------------------------------
-- 1. Integración de WhatsApp con credenciales en Vault
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
insert into t_ctx values ('wa', public.integration_save((select v::uuid from t_ctx where k = 'org'), 'whatsapp',
  '{"access_token":"EAAtest000000","app_secret":"s3cret","verify_token":"vt"}', '+34 600 000 000', '', '00000000-0000-0000-0000-0000000000a1')::text);
select public.integration_set_config((select v::uuid from t_ctx where k = 'org'), 'whatsapp', '{"phone_number_id":"1234567890"}');
select is((select secret::jsonb ->> 'app_secret' from public.integration_secret_by_id((select v::uuid from t_ctx where k = 'wa'))),
          's3cret', 'service_role lee las credenciales por ID');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select config ->> 'phone_number_id' from public.integrations where provider = 'whatsapp'), '1234567890',
          'un miembro ve la configuración pública');
select throws_ok($$ select * from public.integration_secret_by_id((select v::uuid from t_ctx where k = 'wa')) $$,
                 '42501', null, 'un usuario no lee las credenciales');
select throws_ok($$ select * from public.integration_set_config((select v::uuid from t_ctx where k = 'org'), 'whatsapp', '{}') $$,
                 '42501', null, 'un usuario no cambia la configuración');
select pg_temp.logout();

select throws_ok($$ insert into public.integrations (workspace_id, provider, vault_secret_id) values
                    ((select v::uuid from t_ctx where k = 'org'), 'telegram', gen_random_uuid()) $$,
                 '23514', null, 'solo proveedores conocidos');

-- ---------------------------------------------------------------------------
-- 2. Contactos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ insert into public.contacts (workspace_id, name, phone, created_by)
                   values ((select v::uuid from t_ctx where k = 'org'), 'Obra Norte', '+34600111222', '00000000-0000-0000-0000-0000000000a1') $$,
                'un owner añade un contacto');
select throws_ok($$ insert into public.contacts (workspace_id, name, phone, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Mal', '600111222', '00000000-0000-0000-0000-0000000000a1') $$,
                 '23514', null, 'el teléfono va en formato internacional');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.contacts), 1, 'un miembro ve los contactos');
select throws_ok($$ insert into public.contacts (workspace_id, name, phone, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Colado', '+34600999888', '00000000-0000-0000-0000-0000000000b1') $$,
                 '42501', null, 'un member no añade contactos');
select is_empty($$ delete from public.contacts returning id $$, 'un member no borra contactos');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.contacts $$, 'otro espacio no ve los contactos');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 3. Mensajes
-- ---------------------------------------------------------------------------
insert into public.whatsapp_messages (workspace_id, integration_id, direction, phone, body, wa_message_id)
values ((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'wa'), 'in', '34600111222', 'Hola', 'wamid.1');
select throws_ok($$ insert into public.whatsapp_messages (workspace_id, direction, phone, body, wa_message_id)
                    values ((select v::uuid from t_ctx where k = 'org'), 'in', '34600111222', 'Hola', 'wamid.1') $$,
                 '23505', null, 'un mensaje no se registra dos veces');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select body from public.whatsapp_messages), 'Hola', 'el owner ve los mensajes');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select 1 from public.whatsapp_messages $$, 'un member no ve los mensajes');
select throws_ok($$ insert into public.whatsapp_messages (workspace_id, direction, phone, body)
                    values ((select v::uuid from t_ctx where k = 'org'), 'out', '34600111222', 'falso') $$,
                 '42501', null, 'el cliente no escribe mensajes');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 4. Conversaciones y clasificación
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select isnt(public.whatsapp_record_message((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'wa'),
  '34600111222', 'Obra Norte', 'in', 'history', '¿Cuándo llega el hormigón?', 'text', 'wamid.h1', now() - interval '2 days'),
  null, 'registra un mensaje del histórico');
select is(public.whatsapp_record_message((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'wa'),
  '34600111222', 'Obra Norte', 'in', 'history', 'repetido', 'text', 'wamid.h1', now()),
  null, 'un mensaje repetido no se cuenta dos veces');
select public.whatsapp_record_message((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'wa'),
  '34600111222', '', 'out', 'echo', 'Mañana a las 8', 'text', 'wamid.e1', now() - interval '1 day');
select is((select message_count from public.whatsapp_threads where phone = '34600111222'), 2, 'la conversación cuenta sus mensajes');
select is((select contact_name from public.whatsapp_threads where phone = '34600111222'), 'Obra Norte', 'un eco sin nombre no borra el nombre');
select is(public.whatsapp_purge((select v::uuid from t_ctx where k = 'org'), 1), 1, 'la conservación borra lo antiguo');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select isnt_empty($$ update public.whatsapp_threads set category = 'Obra', manually_edited = true returning id $$,
                  'el owner corrige la clasificación');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select 1 from public.whatsapp_threads $$, 'un member no ve las conversaciones');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 5. Borrar el espacio borra el secreto
-- ---------------------------------------------------------------------------
delete from public.workspaces where id = (select v::uuid from t_ctx where k = 'org');
select is((select count(*)::int from vault.secrets where name like 'integration:%'), 0, 'no quedan credenciales huérfanas');

select * from finish();
rollback;
