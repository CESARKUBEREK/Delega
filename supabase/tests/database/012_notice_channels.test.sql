-- =============================================================================
-- Tests de la migración 12 (pgTAP): zona horaria del espacio y canales de aviso.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@test.dev', now());

create temp table t_ctx (k text primary key, v text);
grant select, insert, update on t_ctx to authenticated, service_role;
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
insert into t_ctx values ('org', public.create_organization('Estudio horario')::text);
insert into public.flows (workspace_id, name, definition, settings, created_by)
values ((select v::uuid from t_ctx where k = 'org'), 'Resumen', '{"trigger":{"type":"schedule"},"steps":[]}',
        '{"schedule":{"frequency":"daily","time":"08:00"}}', '00000000-0000-0000-0000-0000000000c1')
returning id::text as flow_id \gset
update public.flows set status = 'active' where id = :'flow_id';
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000c2', 'member');

-- --- Zona horaria
select is(private.workspace_timezone((select v::uuid from t_ctx where k = 'org')), 'Europe/Madrid', 'por defecto, Madrid');
select is(extract(hour from (select next_run_at from public.flows where id = :'flow_id') at time zone 'Europe/Madrid')::int, 8,
          'programada a las 8 de Madrid');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is(public.workspace_set_timezone((select v::uuid from t_ctx where k = 'org'), 'America/Argentina/Buenos_Aires'),
          'America/Argentina/Buenos_Aires', 'un owner cambia la zona horaria');
select pg_temp.logout();
select is(extract(hour from (select next_run_at from public.flows where id = :'flow_id') at time zone 'America/Argentina/Buenos_Aires')::int, 8,
          'la próxima ejecución pasa a las 8 de Buenos Aires');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.workspace_set_timezone((select v::uuid from t_ctx where k = 'org'), 'Marte/Olimpo') $$,
                 '22023', null, 'zona horaria inexistente');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.workspace_set_timezone((select v::uuid from t_ctx where k = 'org'), 'Europe/Paris') $$,
                 '42501', null, 'un miembro no puede cambiarla');

-- --- Preferencias y vinculación de Telegram (miembro c2)
select lives_ok($$ select public.notice_prefs_set((select v::uuid from t_ctx where k = 'org'), true, false, true) $$, 'guarda sus preferencias');
select is((select notify_email from public.user_channels), false, 've sus preferencias');
insert into t_ctx values ('code', public.telegram_link_start((select v::uuid from t_ctx where k = 'org')));
select matches((select v from t_ctx where k = 'code'), '^[A-HJ-NP-Z2-9]{8}$', 'código de 8 caracteres sin ambiguos');
select throws_ok($$ select link_code_hash from public.user_channels $$, '42501', null, 'el código guardado (huella) no es legible');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.user_channels), 0, 'nadie ve los canales de otra persona');
select pg_temp.logout();

set local role service_role;
select is(public.telegram_link_complete((select v::uuid from t_ctx where k = 'org'), 'ZZZZZZZZ', '12345', 'Ana'), null, 'un código incorrecto no vincula');
select is(public.telegram_link_complete((select v::uuid from t_ctx where k = 'org'), (select v from t_ctx where k = 'code'), '12345', 'Ana'),
          '00000000-0000-0000-0000-0000000000c2'::uuid, 'el código correcto vincula el chat a su persona');
select is(public.telegram_link_complete((select v::uuid from t_ctx where k = 'org'), (select v from t_ctx where k = 'code'), '99999', 'Otro'), null,
          'el código es de un solo uso');
reset role;

select * from finish();
rollback;
