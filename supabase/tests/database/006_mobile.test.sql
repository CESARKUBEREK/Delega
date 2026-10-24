-- =============================================================================
-- Tests de la migración 6 (pgTAP): avisos, ejecuciones desde el chat y consumo.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select lives_ok($$ select public.push_subscribe('https://fcm.googleapis.com/fcm/send/dispositivo-a6-000000',
                  repeat('B', 87), repeat('a', 22), 'Android') $$,
                'un usuario registra su dispositivo');
select is((select count(*)::int from public.push_subscriptions), 1, 've su dispositivo');
select throws_ok($$ select p256dh from public.push_subscriptions $$, '42501', null,
                 'no lee las claves del dispositivo');
select throws_ok($$ select public.push_subscribe('http://inseguro.example/x-000000000000000', repeat('B', 87), repeat('a', 22), '') $$,
                 '23514', null, 'solo se admiten endpoints https');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
                   values ('00000000-0000-0000-0000-0000000000a6', 'https://x.example/abcdefghijklmnopqrstu', repeat('B', 87), repeat('a', 22)) $$,
                 '42501', null, 'no se inserta directamente en la tabla');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b6');
select is((select count(*)::int from public.push_subscriptions), 0, 'otro usuario no ve el dispositivo ajeno');
delete from public.push_subscriptions;
select pg_temp.logout();
select is((select count(*)::int from public.push_subscriptions), 1, 'ni puede borrarlo');

-- El mismo navegador, con otra cuenta: el dispositivo pasa a la cuenta nueva.
select pg_temp.login('00000000-0000-0000-0000-0000000000b6');
select public.push_subscribe('https://fcm.googleapis.com/fcm/send/dispositivo-a6-000000', repeat('C', 87), repeat('b', 22), 'Android');
select is((select count(*)::int from public.push_subscriptions), 1, 'el dispositivo pasa a la cuenta que lo registra');
delete from public.push_subscriptions;
select is((select count(*)::int from public.push_subscriptions), 0, 'el usuario borra su dispositivo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Ejecuciones desde el chat
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
insert into t_ctx values ('org', public.create_organization('Estudio Móvil')::text);
insert into t_ctx values ('personal', (select id::text from public.workspaces where kind = 'personal'
                                        and personal_owner = '00000000-0000-0000-0000-0000000000a6'));
select pg_temp.logout();

insert into public.conversations (id, workspace_id, created_by, title)
values ('00000000-0000-0000-0000-00000000c006', (select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000a6', 'Chat');
insert into public.messages (conversation_id, workspace_id, role, content, plan)
values ('00000000-0000-0000-0000-00000000c006', (select v::uuid from t_ctx where k = 'org'), 'assistant', 'Plan', '{"steps": []}');
insert into t_ctx values ('msg', (select max(id)::text from public.messages));

select lives_ok($$ insert into public.flow_runs (workspace_id, flow_name, plan, started_by, source_message_id, trigger)
                   values ((select v::uuid from t_ctx where k = 'org'), 'Desde el chat', '{"steps": []}',
                           '00000000-0000-0000-0000-0000000000a6', (select v::bigint from t_ctx where k = 'msg'),
                           '{"type": "chat"}') $$,
                'una ejecución se enlaza a un mensaje del mismo espacio');
select throws_ok($$ insert into public.flow_runs (workspace_id, flow_name, plan, source_message_id)
                    values ((select v::uuid from t_ctx where k = 'personal'), 'Otro espacio', '{"steps": []}',
                            (select v::bigint from t_ctx where k = 'msg')) $$,
                 '23503', null, 'no se enlaza a un mensaje de otro espacio');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select is((select source_message_id from public.flow_runs where flow_name = 'Desde el chat'),
          (select v::bigint from t_ctx where k = 'msg'), 'quien la lanzó ve el mensaje de origen');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Consumo
-- ---------------------------------------------------------------------------
select lives_ok($$ insert into public.usage_events (workspace_id, provider, model, kind, audio_seconds)
                   values ((select v::uuid from t_ctx where k = 'org'), 'openai', 'gpt-transcribe', 'transcription', 42.5) $$,
                'se registra el consumo de un dictado');
select throws_ok($$ insert into public.usage_events (workspace_id, provider, model, kind)
                    values ((select v::uuid from t_ctx where k = 'org'), 'openai', 'x', 'video') $$,
                 '23514', null, 'el tipo de consumo está acotado');

select * from finish();
rollback;
