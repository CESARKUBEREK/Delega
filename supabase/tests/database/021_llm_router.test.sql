-- =============================================================================
-- Tests de la migración 20261102030000 (pgTAP): router de IA (fase 8-1).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.dev', now());

create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000a8';
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

-- Catálogo: sembrado y legible; nadie de la app lo cambia.
select ok((select count(*) from public.llm_models) >= 10, 'catálogo sembrado');
select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select ok((select count(*) from public.llm_models) >= 10, 'cualquier usuario lee el catálogo');
select throws_ok($$update public.llm_models set price_in = 0$$, '42501', null, 'la app no cambia precios');
select pg_temp.logout();

-- Ajustes: el owner guarda; se normalizan.
select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select is(
  public.workspace_set_ai_routing((select id from t_ws), '{"mode":"expert","daily_usd":2.555,"monthly_usd":"30","stop_at_limit":true,"otro":1}'),
  true, 'el owner guarda el modo');
select pg_temp.logout();
select is(
  (select ai_routing from public.workspaces where id = (select id from t_ws)),
  '{"mode": "expert", "learning": true, "daily_usd": 2.56, "stop_at_limit": true, "cross_provider": false}'::jsonb,
  'importes válidos redondeados, texto y claves desconocidas fuera');

select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select public.workspace_set_ai_routing((select id from t_ws), '{"mode":"turbo","learning":false}');
select pg_temp.logout();
select is((select ai_routing ->> 'mode' from public.workspaces where id = (select id from t_ws)), 'smart', 'modo desconocido → Inteligente');
select is((select ai_routing -> 'learning' from public.workspaces where id = (select id from t_ws)), 'false'::jsonb, 'aprender se puede apagar');

-- Quien no es miembro no cambia nada ni ve el gasto.
select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select is(public.workspace_set_ai_routing((select id from t_ws), '{"mode":"eco"}'), false, 'quien no es admin no lo cambia');
select is((select count(*) from public.ai_spend((select id from t_ws))), 0::bigint, 'ni ve el gasto');
select pg_temp.logout();

-- Gasto: suma el coste del mes y del día.
insert into public.usage_events (workspace_id, provider, model, input_tokens, output_tokens, cost_usd, task, created_by)
values ((select id from t_ws), 'openai', 'gpt-6-luna', 1000, 100, 0.25, 'classify', '00000000-0000-0000-0000-0000000000a8'),
       ((select id from t_ws), 'openai', 'gpt-6.1-sol', 1000, 100, 0.50, 'agent', '00000000-0000-0000-0000-0000000000a8');
select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select is((select month_usd from public.ai_spend((select id from t_ws))), 0.75::numeric, 'gasto del mes');
select is((select count(*) from public.ai_spend_breakdown((select id from t_ws), now() - interval '1 day')), 2::bigint, 'desglose por modelo y tarea');
select throws_ok($$insert into public.ai_budget_alerts (workspace_id, period, level) select id, 'month:2026-11', 80 from t_ws$$, '42501', null, 'los avisos solo los escribe el servidor');
select pg_temp.logout();

-- Coste de una ejecución: solo service_role suma.
insert into public.flow_runs (workspace_id, flow_name, plan, started_by)
values ((select id from t_ws), 'Prueba', '{}', '00000000-0000-0000-0000-0000000000a8');
select is(public.flow_run_add_cost((select id from public.flow_runs where flow_name = 'Prueba'), 0.1234), 0.1234::numeric, 'suma el coste');
select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select throws_ok($$select public.flow_run_add_cost((select id from public.flow_runs where flow_name = 'Prueba'), 1)$$, '42501', null, 'la app no suma costes');
select pg_temp.logout();

select * from finish();
rollback;
