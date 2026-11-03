-- =============================================================================
-- Tests de las migraciones 20261101190000 y 20261103200000 (pgTAP): planes de
-- prueba del onboarding (2 por espacio personal, tope de 30.000 tokens).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.dev', now());

create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000a7';

select is((select allowance_plans from public.workspace_trial_credits where workspace_id = (select id from t_ws)), 2,
  'el espacio personal nuevo recibe 2 planes de prueba');
select is((select allowance_tokens from public.workspace_trial_credits where workspace_id = (select id from t_ws)), 30000::bigint,
  'con un tope de 30.000 tokens');

insert into public.workspaces (kind, name, created_by) values ('organization', 'Equipo prueba', '00000000-0000-0000-0000-0000000000a7');
select is((select count(*) from public.workspace_trial_credits t join public.workspaces w on w.id = t.workspace_id where w.name = 'Equipo prueba'), 0::bigint,
  'un espacio de equipo no recibe créditos');

select is(public.trial_consume((select id from t_ws), 8000), 1::bigint, 'primer plan: queda uno');
select is(public.trial_consume((select id from t_ws), 8000), 0::bigint, 'segundo plan: no quedan');
select is(public.trial_consume((select id from t_ws), 30000), 0::bigint, 'un tercero no da planes negativos');
select is((select used_tokens from public.workspace_trial_credits where workspace_id = (select id from t_ws)), 30000::bigint,
  'lo gastado no supera el tope de tokens');

set local role authenticated;
select throws_ok(format('select public.trial_consume(%L, 1)', (select id from t_ws)), '42501', null, 'authenticated no puede consumir');
reset role;

select * from finish();
rollback;
