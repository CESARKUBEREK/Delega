-- Costo real y quién paga cada llamada (migración 20261111200000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000d9', 'd9@test.dev', now());
create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000d9';

insert into public.usage_events (workspace_id, provider, model, input_tokens, output_tokens, cost_usd, created_by)
select id, 'openai', 'gpt-6-luna', 1000, 100, 0, '00000000-0000-0000-0000-0000000000d9' from t_ws;

select is((select funded_by from public.usage_events where workspace_id = (select id from t_ws)), 'workspace',
  'por defecto la llamada la paga el espacio');
select is((select real_cost_usd from public.usage_events where workspace_id = (select id from t_ws)), 0::numeric,
  'por defecto el costo real es 0 si no se informa');
select throws_ok(
  $$insert into public.usage_events (workspace_id, provider, model, funded_by) select id, 'openai', 'gpt-6-luna', 'otro' from t_ws$$,
  '23514', null, 'funded_by solo admite workspace o marchasolo');
select throws_ok(
  $$insert into public.usage_events (workspace_id, provider, model, real_cost_usd) select id, 'openai', 'gpt-6-luna', -1 from t_ws$$,
  '23514', null, 'el costo real no puede ser negativo');

select * from finish();
rollback;
