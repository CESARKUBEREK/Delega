-- Prueba atómica del cupo de una ejecución real gratuita.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c7', 'c7@test.dev', now());
create temp table t_personal as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000c7';

select is((select allowance_runs from public.workspace_trial_credits where workspace_id = (select id from t_personal)), 1,
  'el espacio personal recibe una ejecución real gratuita');
select is((select used_runs from public.workspace_trial_credits where workspace_id = (select id from t_personal)), 0,
  'el cupo empieza sin consumir');
select is(public.trial_run_consume((select id from t_personal)), true,
  'la primera ejecución puede reservarse');
select is(public.trial_run_consume((select id from t_personal)), false,
  'no se puede reservar una segunda ejecución');
select is((select used_runs from public.workspace_trial_credits where workspace_id = (select id from t_personal)), 1,
  'el contador no supera el cupo');

select * from finish();
rollback;
