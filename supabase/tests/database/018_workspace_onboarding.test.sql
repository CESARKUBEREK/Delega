-- =============================================================================
-- Tests de la migración 20261101180000 (pgTAP): onboarding terminado.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.dev', now());

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

-- Espacio personal de A (lo crea el alta de usuario).
create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000a8';

select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select is(public.workspace_complete_onboarding((select id from t_ws)), false, 'quien no es miembro no puede marcarlo');
select pg_temp.logout();
select is((select onboarding_completed_at from public.workspaces where id = (select id from t_ws)), null, 'sigue sin marcar');

select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select is(public.workspace_complete_onboarding((select id from t_ws)), true, 'el owner lo marca');
select throws_ok(
  format('update public.workspaces set onboarding_completed_at = null where id = %L', (select id from t_ws)),
  '42501', null, 'la columna no se puede cambiar directamente');
select pg_temp.logout();
select isnt((select onboarding_completed_at from public.workspaces where id = (select id from t_ws)), null, 'queda la fecha');

select * from finish();
rollback;
