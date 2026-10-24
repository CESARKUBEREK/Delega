-- =============================================================================
-- Tests de la migración 4 (pgTAP): Gmail, Telegram, contactos y bandeja.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

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
insert into t_ctx values ('org', public.create_organization('Estudio Bandeja')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'member');

-- ---------------------------------------------------------------------------
-- 1. Integraciones de correo (IMAP) y Telegram
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
insert into t_ctx values ('tg', public.integration_save((select v::uuid from t_ctx where k = 'org'), 'telegram',
  '{"bot_token":"123:ABC","secret_token":"s3cret"}', '@delega_bot', '', '00000000-0000-0000-0000-0000000000a1')::text);
select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'imap', '{"user":"a@estudio.es","password":"x"}', 'a@estudio.es', '', '00000000-0000-0000-0000-0000000000a1');
select public.integration_set_config((select v::uuid from t_ctx where k = 'org'), 'telegram', '{"bot_username":"delega_bot"}');
select is((select secret::jsonb ->> 'secret_token' from public.integration_secret_by_id((select v::uuid from t_ctx where k = 'tg'))),
          's3cret', 'service_role lee el secreto del bot por ID');
select is((select count(*)::int from public.integrations where workspace_id = (select v::uuid from t_ctx where k = 'org')), 2,
          'correo y Telegram conviven en el espacio');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select config ->> 'bot_username' from public.integrations where provider = 'telegram'), 'delega_bot',
          'un miembro ve la configuración pública');
select throws_ok($$ select * from public.integration_secret_by_id((select v::uuid from t_ctx where k = 'tg')) $$,
                 '42501', null, 'un usuario no lee el token del bot');
select throws_ok($$ select * from public.integration_set_config((select v::uuid from t_ctx where k = 'org'), 'telegram', '{}') $$,
                 '42501', null, 'un usuario no cambia la configuración');
select pg_temp.logout();

select throws_ok($$ insert into public.integrations (workspace_id, provider, vault_secret_id) values
                    ((select v::uuid from t_ctx where k = 'org'), 'whatsapp', gen_random_uuid()) $$,
                 '23514', null, 'solo proveedores conocidos');

-- ---------------------------------------------------------------------------
-- 2. Contactos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ insert into public.contacts (workspace_id, name, email, created_by)
                   values ((select v::uuid from t_ctx where k = 'org'), 'Obra Norte', 'obra@norte.es', '00000000-0000-0000-0000-0000000000a1') $$,
                'un owner añade un contacto');
select throws_ok($$ insert into public.contacts (workspace_id, name, email, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Mal', 'no-es-un-correo', '00000000-0000-0000-0000-0000000000a1') $$,
                 '23514', null, 'el correo debe ser válido');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.contacts), 1, 'un miembro ve los contactos');
select throws_ok($$ insert into public.contacts (workspace_id, name, email, created_by)
                    values ((select v::uuid from t_ctx where k = 'org'), 'Colado', 'x@y.es', '00000000-0000-0000-0000-0000000000b1') $$,
                 '42501', null, 'un member no añade contactos');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select 1 from public.contacts $$, 'otro espacio no ve los contactos');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 3. Bandeja
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select isnt(public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'tg'),
  'telegram', '555', '555:1', 'in', 'Ana', '@ana', null, null, 'Hola, ¿cuándo pasáis por obra?', now() - interval '2 days', 'Ana', '@ana'),
  null, 'registra un mensaje de Telegram');
select is(public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), (select v::uuid from t_ctx where k = 'tg'),
  'telegram', '555', '555:1', 'in', 'Ana', '@ana', null, null, 'repetido', now(), 'Ana', '@ana'),
  null, 'un mensaje repetido no se cuenta dos veces');
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null,
  'email', 'thr-1', 'msg-1', 'in', 'Proveedor', 'ventas@prov.es', 'a@gmail.com', 'Presupuesto', 'Adjunto presupuesto', now(), 'Proveedor', 'ventas@prov.es');
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null,
  'email', 'thr-1', 'msg-2', 'out', null, 'a@gmail.com', 'ventas@prov.es', 'Re: Presupuesto', 'Gracias', now(), '', '');
select is((select message_count from public.inbox_threads where external_id = 'thr-1'), 2, 'el hilo cuenta sus mensajes');
select is((select contact_name from public.inbox_threads where external_id = 'thr-1'), 'Proveedor', 'una respuesta propia no borra el contacto');
select is((select subject from public.inbox_threads where external_id = 'thr-1'), 'Presupuesto', 'el asunto es el del primer mensaje');
select is(public.inbox_purge((select v::uuid from t_ctx where k = 'org'), 1), 1, 'la conservación borra lo antiguo');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select isnt_empty($$ update public.inbox_threads set category = 'Obra', manually_edited = true where external_id = 'thr-1' returning id $$,
                  'el owner corrige la clasificación');
select throws_ok($$ insert into public.inbox_messages (workspace_id, thread_id, channel, direction, external_id, body)
                    values ((select v::uuid from t_ctx where k = 'org'), (select id from public.inbox_threads limit 1), 'email', 'out', 'x', 'falso') $$,
                 '42501', null, 'el cliente no escribe mensajes');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select 1 from public.inbox_threads $$, 'un member no ve la bandeja');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 4. Borrar el espacio borra los secretos
-- ---------------------------------------------------------------------------
delete from public.workspaces where id = (select v::uuid from t_ctx where k = 'org');
select is((select count(*)::int from vault.secrets where name like 'integration:%'), 0, 'no quedan credenciales huérfanas');

select * from finish();
rollback;
