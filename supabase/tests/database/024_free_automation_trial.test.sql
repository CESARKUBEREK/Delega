-- Prueba del cupo reservado de una ejecución real gratuita.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c7', 'c7@test.dev', now());
create temp table t_personal as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000c7';

insert into public.flow_runs (workspace_id, flow_name, plan, started_by)
select id, 'Prueba gratuita', '{}', '00000000-0000-0000-0000-0000000000c7' from t_personal;
create temp table t_run as
  select id from public.flow_runs where flow_name = 'Prueba gratuita';

select is((select allowance_runs from public.workspace_trial_credits where workspace_id = (select id from t_personal)), 1,
  'el espacio personal recibe una ejecución real gratuita');
select is((select used_runs from public.workspace_trial_credits where workspace_id = (select id from t_personal)), 0,
  'el cupo empieza sin consumir');
select is(public.trial_run_consume((select id from t_personal), (select id from t_run)), true,
  'la primera ejecución puede reservarse');
select is(public.trial_run_consume((select id from t_personal), (select id from t_run)), false,
  'no se puede reservar una segunda ejecución mientras está reservada');
select is(public.trial_run_release((select id from t_personal), (select id from t_run)), true,
  'un intento sin uso libera la reserva');
select is(public.trial_run_consume((select id from t_personal), (select id from t_run)), true,
  'el cupo liberado puede volver a reservarse');
select is(public.trial_run_commit((select id from t_personal), (select id from t_run)), true,
  'la primera llamada correcta confirma el consumo');

select * from finish();
rollback;
