-- =============================================================================
-- Tests de la migración 20261101210000 (pgTAP): embudo del onboarding.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@test.dev', now());

create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000a6';
grant select on t_ws to authenticated;

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select lives_ok(format('select public.onboarding_track(%L, ''plan'', ''{"source":"local","plan":"Responder","otro":"x"}'')', (select id from t_ws)), 'el owner registra un paso');
select lives_ok(format('select public.onboarding_track(%L, ''plan'', ''{}'')', (select id from t_ws)), 'repetir no falla');
select pg_temp.logout();

select is((select count(*) from public.onboarding_events where workspace_id = (select id from t_ws)), 1::bigint, 'solo la primera vez');
select is((select detail from public.onboarding_events where workspace_id = (select id from t_ws)), '{"plan": "Responder", "source": "local"}'::jsonb, 'solo las claves conocidas');

select pg_temp.login('00000000-0000-0000-0000-0000000000b6');
select public.onboarding_track((select id from t_ws), 'task', '{}');
select pg_temp.logout();
select is((select count(*) from public.onboarding_events where workspace_id = (select id from t_ws)), 1::bigint, 'quien no es miembro no registra nada');

select * from finish();
rollback;
