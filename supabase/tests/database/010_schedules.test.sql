-- =============================================================================
-- Tests de la migración 10 (pgTAP): ejecuciones programadas.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- --- Cálculo de la próxima ejecución (hora local de Madrid)
select is(private.flow_next_run('{"frequency":"daily","time":"08:00"}', 'Europe/Madrid', '2026-10-24 19:00+02'),
          '2026-10-25 08:00+01'::timestamptz, 'cada día: mañana a las 8, ya en horario de invierno');
select is(private.flow_next_run('{"frequency":"daily","time":"08:00"}', 'Europe/Madrid', '2026-10-24 07:59+02'),
          '2026-10-24 08:00+02'::timestamptz, 'cada día: hoy si aún no ha pasado la hora');
select is(private.flow_next_run('{"frequency":"weekdays","time":"08:00"}', 'Europe/Madrid', '2026-10-24 19:00+02'),
          '2026-10-26 08:00+01'::timestamptz, 'días laborables: el sábado salta al lunes');
select is(private.flow_next_run('{"frequency":"weekly","time":"17:30","weekday":5}', 'Europe/Madrid', '2026-10-30 17:30+01'),
          '2026-11-06 17:30+01'::timestamptz, 'semanal: a la misma hora pasa a la semana siguiente');
select is(private.flow_next_run('{"frequency":"monthly","time":"09:00","day_of_month":0}', 'Europe/Madrid', '2027-02-10 00:00+01'),
          '2027-02-28 09:00+01'::timestamptz, 'mensual: el último día de febrero');
select is(private.flow_next_run('{"frequency":"monthly","time":"09:00","day_of_month":1}', 'Europe/Madrid', '2026-10-24 12:00+02'),
          '2026-11-01 09:00+01'::timestamptz, 'mensual: el día 1');
select is(private.flow_next_run('{"frequency":"daily","time":"08:00"}', 'America/Buenos_Aires', '2026-10-24 12:00Z'),
          '2026-10-25 08:00-03'::timestamptz, 'otra zona horaria');
select is(private.flow_next_run('{"frequency":"hourly","time":"08:00"}', 'Europe/Madrid', now()), null, 'frecuencia no admitida');
select is(private.flow_next_run('{"frequency":"daily","time":"25:00"}', 'Europe/Madrid', now()), null, 'hora no válida');
select is(private.flow_next_run('{"frequency":"monthly","time":"09:00","day_of_month":31}', 'Europe/Madrid', now()), null, 'día del mes no admitido');

-- --- Trigger y flows_due
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000aa', 'aa@test.dev', now());
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

select pg_temp.login('00000000-0000-0000-0000-0000000000aa');
insert into t_ctx values ('org', public.create_organization('Estudio programado')::text);
insert into public.flows (workspace_id, name, definition, settings, created_by, next_run_at)
values ((select v::uuid from t_ctx where k = 'org'), 'Resumen de la mañana',
        '{"trigger":{"type":"schedule","description":"Cada día"},"steps":[]}',
        '{"schedule":{"frequency":"daily","time":"08:00"}}', '00000000-0000-0000-0000-0000000000aa', now() - interval '1 day')
returning id::text as flow_id \gset
select is((select next_run_at from public.flows where id = :'flow_id'), null, 'un borrador no se programa (aunque se intente fijar la fecha)');
update public.flows set status = 'active' where id = :'flow_id';
select ok((select next_run_at > now() and next_run_at <= now() + interval '1 day' from public.flows where id = :'flow_id'),
          'al activarlo se calcula la próxima ejecución');
select throws_ok($$ update public.flows set next_run_at = now() where status = 'active' $$, '42501', null,
                 'el usuario no puede cambiar la fecha a mano');
update public.flows set status = 'paused' where id = :'flow_id';
select is((select next_run_at from public.flows where id = :'flow_id'), null, 'al pausarlo deja de estar programado');
update public.flows set status = 'active' where id = :'flow_id';
select pg_temp.logout();

-- Simula que tocaba hace 10 minutos (y otra hace 7 horas).
update public.flows set next_run_at = now() - interval '10 minutes' where id = :'flow_id';
insert into public.flows (workspace_id, name, definition, settings, created_by, status)
values ((select v::uuid from t_ctx where k = 'org'), 'Perdida', '{"trigger":{"type":"schedule"},"steps":[]}',
        '{"schedule":{"frequency":"daily","time":"08:00"}}', '00000000-0000-0000-0000-0000000000aa', 'active')
returning id::text as lost_id \gset
update public.flows set next_run_at = now() - interval '7 hours' where id = :'lost_id';

set local role service_role;
create temp table t_due as select * from public.flows_due(10);
select is((select string_agg(name || ':' || launch, ',' order by name) from t_due), 'Perdida:false,Resumen de la mañana:true',
          'toma las que tocan; la perdida hace más de 6 h no se lanza');
select is((select count(*)::int from public.flows_due(10)), 0, 'una segunda llamada no vuelve a tomarlas');
select ok((select bool_and(next_run_at > now()) from public.flows where id in (:'flow_id', :'lost_id')), 'su próxima ejecución avanza');

select * from finish();
rollback;
