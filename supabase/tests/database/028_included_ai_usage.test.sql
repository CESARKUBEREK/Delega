-- IA incluida: periodos de uso y prueba de 14 días (migración 20261111210000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.dev', now());
create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000e1';

select is((select count(*)::int from public.usage_current((select id from t_ws))), 0,
  'sin periodo, el espacio no tiene IA incluida');
select is(public.usage_consume((select id from t_ws), 'run', 1, 0.01), false,
  'sin periodo, no se apunta nada');

select ok(public.usage_open_period((select id from t_ws), 'solo', now() - interval '1 day', now() + interval '29 days') is not null,
  'se abre un periodo del plan Solo');
select is((select tasks_allowance from public.usage_current((select id from t_ws))), 200, 'Solo trae 200 tareas');
select is((select usd_cap from public.usage_current((select id from t_ws))), 10::numeric, 'Solo tiene un tope de 10 USD');

select is(public.usage_consume((select id from t_ws), 'run', 1, 0.02), true, 'una ejecución se apunta');
select is(public.usage_consume((select id from t_ws), 'inbox_classify', 0, 0.0001), true, 'clasificar suma solo USD');
select is((select tasks_left from public.usage_current((select id from t_ws))), 199::numeric, 'queda 199 tareas');
select throws_ok($$select public.usage_consume((select id from t_ws), 'otra_cosa', 1, 0)$$, '22023', null,
  'un tipo desconocido se rechaza');

select ok((select expires_at > now() + interval '13 days' from public.workspace_trial_credits where workspace_id = (select id from t_ws)),
  'la prueba de un espacio nuevo dura 14 días');

select * from finish();
rollback;
