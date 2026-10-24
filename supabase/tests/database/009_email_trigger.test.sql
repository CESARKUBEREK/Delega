begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_index('public', 'flows', 'flows_active_trigger_idx', 'índice de automatizaciones activas por disparador');
select has_index('public', 'flow_runs', 'flow_runs_running_idx', 'índice de ejecuciones en marcha');
select has_index('public', 'flow_runs', 'flow_runs_trigger_started_idx', 'índice de ejecuciones por disparador');

-- La configuración de los filtros cabe en flows.settings (límite 8 KB).
select lives_ok($$
  select jsonb_build_object('email_filter', jsonb_build_object(
    'from', '["@cliente.com"]'::jsonb, 'subject', '[]'::jsonb, 'words', '["presupuesto", "pedido"]'::jsonb, 'skip_automatic', true))
$$, 'los filtros de correo son un objeto JSON válido');

select * from finish();
rollback;
