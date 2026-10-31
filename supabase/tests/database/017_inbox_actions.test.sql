-- =============================================================================
-- Tests de la migración 20261031090000 (pgTAP): bandeja de acciones (fase 6G).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a9', 'a9@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b9', 'b9@test.dev', now());

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a9');
insert into t_ctx values ('org', public.create_organization('Inmobiliaria Sur')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b9', 'member');

-- Un correo recibido y, más tarde, nuestra respuesta.
select pg_temp.as_service();
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null, 'email', 'hilo-1', 'm-1', 'in',
  'Laura', 'laura@inmo.test', '', 'Visita', 'Quiero ver el piso', now() - interval '2 hours', 'Laura', 'laura@inmo.test');
select is((select last_direction from public.inbox_threads where external_id = 'hilo-1'), 'in', 'el último mensaje es del contacto');
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null, 'email', 'hilo-1', 'm-2', 'out',
  '', 'yo@inmo.test', 'laura@inmo.test', 'Re: Visita', 'El jueves a las 11', now() - interval '1 hour', '', '');
select is((select last_direction from public.inbox_threads where external_id = 'hilo-1'), 'out', 'tras responder, el último es nuestro');
-- Un mensaje antiguo que llega tarde no cambia la dirección.
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null, 'email', 'hilo-1', 'm-0', 'in',
  'Laura', 'laura@inmo.test', '', 'Visita', 'Hola', now() - interval '3 days', 'Laura', 'laura@inmo.test');
select is((select last_direction from public.inbox_threads where external_id = 'hilo-1'), 'out', 'un mensaje antiguo no cambia la dirección');
select pg_temp.logout();

-- Reglas: el admin las crea; un miembro no las ve ni las crea.
select pg_temp.login('00000000-0000-0000-0000-0000000000a9');
select lives_ok($$ insert into public.inbox_rules (workspace_id, match_type, value, category)
                   values ((select v::uuid from t_ctx where k = 'org'), 'domain', 'inmo.test', 'Cliente') $$,
                'un admin crea una regla');
select throws_ok($$ insert into public.inbox_rules (workspace_id, match_type, value, category)
                    values ((select v::uuid from t_ctx where k = 'org'), 'domain', 'Inmo.TEST', 'Cliente') $$,
                 '23514', null, 'el valor de la regla va en minúsculas');
select lives_ok($$ update public.inbox_threads set prepare_dismissed_at = now(), followup_muted = true
                   where external_id = 'hilo-1' $$, 'un admin descarta una tarjeta');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000b9');
select is((select count(*)::int from public.inbox_rules), 0, 'un miembro no ve las reglas');
select throws_ok($$ select * from public.inbox_workspaces_pending(5) $$, '42501', null,
                 'un usuario no lista la cola de clasificación');
select pg_temp.logout();

-- Si el contacto vuelve a escribir, la tarjeta descartada vuelve.
select pg_temp.as_service();
select public.inbox_record_message((select v::uuid from t_ctx where k = 'org'), null, 'email', 'hilo-1', 'm-3', 'in',
  'Laura', 'laura@inmo.test', '', 'Re: Visita', '¿Y el viernes?', now(), 'Laura', 'laura@inmo.test');
select is((select prepare_dismissed_at from public.inbox_threads where external_id = 'hilo-1'), null,
          'un mensaje nuevo del contacto reabre la tarjeta');
select pg_temp.logout();

select * from finish();
rollback;
