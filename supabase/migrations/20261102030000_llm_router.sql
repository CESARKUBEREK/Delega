-- =============================================================================
-- Fase 8-1: Smart LLM Router (routing y costes).
--
-- * llm_models: catálogo de modelos con precios oficiales fechados (USD por
--   millón de tokens). Los precios viven aquí y no en el código: se cambian con
--   SQL sin desplegar. Lectura para cualquier usuario; escribe service_role.
-- * workspaces.ai_routing: modo (eco | smart | expert), usar otras IAs,
--   presupuestos diario, mensual y por ejecución, parar al límite. Se cambia
--   con workspace_set_ai_routing (solo owners y admins).
-- * usage_events: cada llamada guarda tarea, ejecución, papel, tokens en caché
--   y de razonamiento, coste estimado y latencia. Nunca texto.
-- * flow_runs: decisión del router (routing), coste acumulado y presupuesto.
-- * ai_budget_alerts: avisos del 80 % y 100 % ya enviados (uno por periodo).
-- * ai_spend / ai_spend_breakdown: gasto del día y del mes (UTC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de modelos
-- -----------------------------------------------------------------------------
create table public.llm_models (
  model                  text primary key check (char_length(model) between 1 and 80),
  provider               text not null check (provider in ('openai', 'anthropic', 'deepseek', 'xai', 'google')),
  label                  text not null check (char_length(label) between 1 and 80),
  tier                   text not null check (tier in ('economy', 'standard', 'premium')),
  -- Calidad de partida 0–100 si se conoce; si es null, la del nivel (tier).
  quality_prior          smallint check (quality_prior between 0 and 100),
  price_in               numeric(10, 4) not null check (price_in >= 0),
  price_cached_in        numeric(10, 4) check (price_cached_in >= 0),
  price_cache_write      numeric(10, 4) check (price_cache_write >= 0),
  price_out              numeric(10, 4) not null check (price_out >= 0),
  -- Precio de contexto largo: se aplica a toda la petición si la entrada llega al umbral.
  long_context_threshold int check (long_context_threshold > 0),
  long_price_in          numeric(10, 4) check (long_price_in >= 0),
  long_price_cached_in   numeric(10, 4) check (long_price_cached_in >= 0),
  long_price_out         numeric(10, 4) check (long_price_out >= 0),
  -- null = el proveedor no lo publica; el router no filtra por contexto.
  context_tokens         int check (context_tokens > 0),
  capabilities           text[] not null default '{}',
  latency                text not null default 'normal' check (latency in ('fast', 'normal', 'slow')),
  status                 text not null default 'active' check (status in ('active', 'degraded', 'deprecated')),
  prices_updated_at      date not null,
  prices_source_url      text not null check (prices_source_url like 'https://%'),
  notes                  text not null default '' check (char_length(notes) <= 500),
  updated_at             timestamptz not null default now()
);

comment on table public.llm_models is
  'Catálogo del router: precios oficiales en USD por millón de tokens, con fecha y fuente. Solo service_role escribe.';

create trigger llm_models_set_updated_at before update on public.llm_models
  for each row execute function private.set_updated_at();

alter table public.llm_models enable row level security;
create policy llm_models_select_all on public.llm_models for select to authenticated using (true);
revoke all on public.llm_models from anon, authenticated;
grant select on public.llm_models to authenticated;
grant all on public.llm_models to service_role;

-- Precios copiados el 2 nov 2026 de las páginas oficiales de cada proveedor.
-- DeepSeek cobra la mitad fuera de su hora punta: se guarda el precio de hora
-- punta (estimación prudente).
insert into public.llm_models
  (model, provider, label, tier, price_in, price_cached_in, price_cache_write, price_out,
   long_context_threshold, long_price_in, long_price_cached_in, long_price_out,
   context_tokens, capabilities, latency, prices_updated_at, prices_source_url, notes)
values
  ('gpt-6-luna', 'openai', 'GPT-6 Luna', 'economy', 0.10, 0.01, null, 0.50,
   null, null, null, null, null, '{tools,json}', 'fast', '2026-11-02', 'https://developers.openai.com/api/docs/pricing', ''),
  ('gpt-6.1-sol', 'openai', 'GPT-6.1 Sol', 'standard', 2.00, 0.10, null, 10.00,
   null, null, null, null, null, '{tools,json,reasoning}', 'normal', '2026-11-02', 'https://developers.openai.com/api/docs/pricing', ''),
  ('gpt-6-astra', 'openai', 'GPT-6 Astra', 'premium', 10.00, 1.00, null, 50.00,
   null, null, null, null, null, '{tools,json,reasoning}', 'slow', '2026-11-02', 'https://developers.openai.com/api/docs/pricing', ''),
  ('claude-haiku-5-5', 'anthropic', 'Claude Haiku 5.5', 'economy', 0.10, 0.01, 0.125, 0.50,
   100000, 0.50, 0.05, 2.50, null, '{tools,json}', 'fast', '2026-11-02', 'https://platform.claude.com/docs/en/about-claude/pricing',
   'Más de 100.000 tokens de entrada: precio de contexto largo.'),
  ('claude-sonnet-5-5', 'anthropic', 'Claude Sonnet 5.5', 'standard', 2.00, 0.10, 2.50, 10.00,
   null, null, null, null, 1000000, '{tools,json,reasoning}', 'normal', '2026-11-02', 'https://platform.claude.com/docs/en/about-claude/pricing', ''),
  ('claude-opus-5-5', 'anthropic', 'Claude Opus 5.5', 'premium', 4.00, 0.20, 5.00, 20.00,
   null, null, null, null, 1000000, '{tools,json,reasoning}', 'slow', '2026-11-02', 'https://platform.claude.com/docs/en/about-claude/pricing', ''),
  ('claude-fable-5-1', 'anthropic', 'Claude Fable 5.1', 'premium', 10.00, 0.25, 12.50, 50.00,
   null, null, null, null, 1000000, '{tools,json,reasoning}', 'slow', '2026-11-02', 'https://platform.claude.com/docs/en/about-claude/pricing', ''),
  ('deepseek-flash', 'deepseek', 'DeepSeek V4.1 Flash', 'economy', 0.30, 0.006, null, 1.20,
   null, null, null, null, 1000000, '{tools,json}', 'fast', '2026-11-02', 'https://api-docs.deepseek.com/quick_start/pricing',
   'Precio de hora punta; fuera de ella, la mitad.'),
  ('deepseek-v4-pro', 'deepseek', 'DeepSeek V4 Pro', 'standard', 1.32, 0.044, null, 3.96,
   null, null, null, null, 1000000, '{tools,json}', 'normal', '2026-11-02', 'https://api-docs.deepseek.com/quick_start/pricing',
   'Precio de hora punta; fuera de ella, la mitad.'),
  ('grok-4.7', 'xai', 'Grok 4.7', 'standard', 2.00, 0.50, null, 6.00,
   200000, 4.00, 1.00, 12.00, 500000, '{tools,json,reasoning}', 'normal', '2026-11-02', 'https://docs.x.ai/developers/pricing',
   'Desde 200.000 tokens de entrada: precio de contexto largo.');

-- -----------------------------------------------------------------------------
-- 2. Ajustes del router por espacio
-- -----------------------------------------------------------------------------
alter table public.workspaces
  add column if not exists ai_routing jsonb not null default '{}'::jsonb
  check (jsonb_typeof(ai_routing) = 'object' and pg_column_size(ai_routing) <= 2048);

comment on column public.workspaces.ai_routing is
  'Router de IA: mode (eco|smart|expert), learning, cross_provider, daily_usd, monthly_usd, run_usd, stop_at_limit.';

create function private.usd_or_null(p jsonb) returns numeric
language sql immutable set search_path = '' as $$
  -- CASE anidado: el cast solo se evalúa si es un número.
  select case when jsonb_typeof(p) = 'number' then
    case when (p #>> '{}')::numeric between 0.01 and 100000 then round((p #>> '{}')::numeric, 2) end
  end;
$$;
revoke all on function private.usd_or_null(jsonb) from public, anon, authenticated;

-- authenticated solo puede actualizar workspaces.name: esto va por función.
create function public.workspace_set_ai_routing(p_workspace_id uuid, p_settings jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := coalesce(p_settings ->> 'mode', 'smart');
begin
  if not private.has_role(p_workspace_id, 'admin') then
    return false;
  end if;
  if v_mode not in ('eco', 'smart', 'expert') then
    v_mode := 'smart';
  end if;
  update public.workspaces
     set ai_routing = jsonb_strip_nulls(jsonb_build_object(
       'mode', v_mode,
       'learning', coalesce((p_settings -> 'learning') = 'true'::jsonb, false) or (p_settings -> 'learning') is null,
       'cross_provider', coalesce((p_settings -> 'cross_provider') = 'true'::jsonb, false),
       'stop_at_limit', coalesce((p_settings -> 'stop_at_limit') = 'true'::jsonb, false),
       'daily_usd', private.usd_or_null(p_settings -> 'daily_usd'),
       'monthly_usd', private.usd_or_null(p_settings -> 'monthly_usd'),
       'run_usd', private.usd_or_null(p_settings -> 'run_usd')
     ))
   where id = p_workspace_id;
  return true;
end;
$$;
revoke all on function public.workspace_set_ai_routing(uuid, jsonb) from public, anon;
grant execute on function public.workspace_set_ai_routing(uuid, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Consumo por llamada
-- -----------------------------------------------------------------------------
alter table public.usage_events
  add column task text check (task is null or task in
    ('classify', 'summarize', 'help', 'plan', 'draft_reply', 'agent', 'review', 'transcribe')),
  add column run_id uuid,
  add column step_type text not null default 'primary'
    check (step_type in ('primary', 'fallback', 'escalation', 'verify', 'parallel', 'subtask', 'evaluate')),
  add column cached_tokens int not null default 0 check (cached_tokens >= 0),
  add column cache_write_tokens int not null default 0 check (cache_write_tokens >= 0),
  add column reasoning_tokens int not null default 0 check (reasoning_tokens >= 0),
  add column cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  add column latency_ms int check (latency_ms >= 0),
  add foreign key (run_id, workspace_id)
    references public.flow_runs (id, workspace_id) on delete set null (run_id);

create index usage_events_run_idx on public.usage_events (run_id) where run_id is not null;

comment on column public.usage_events.cost_usd is
  'Coste estimado: tokens que informa el proveedor × precio de llm_models en el momento de la llamada.';

-- -----------------------------------------------------------------------------
-- 4. Ejecuciones: decisión, coste y presupuesto
-- -----------------------------------------------------------------------------
alter table public.flow_runs
  add column routing jsonb check (routing is null or (jsonb_typeof(routing) = 'object' and pg_column_size(routing) <= 8192)),
  add column routing_mode text check (routing_mode is null or routing_mode in ('eco', 'smart', 'expert', 'fixed', 'trial')),
  add column cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  add column budget_usd numeric(12, 4) check (budget_usd is null or budget_usd > 0);

grant select (routing, routing_mode, cost_usd, budget_usd) on public.flow_runs to authenticated;

-- Suma el coste de una llamada a su ejecución (sin carreras entre vueltas).
create function public.flow_run_add_cost(p_run_id uuid, p_cost numeric)
returns numeric
language sql
security definer
set search_path = ''
as $$
  update public.flow_runs
     set cost_usd = cost_usd + greatest(coalesce(p_cost, 0), 0)
   where id = p_run_id
  returning cost_usd;
$$;
revoke all on function public.flow_run_add_cost(uuid, numeric) from public, anon, authenticated;
grant execute on function public.flow_run_add_cost(uuid, numeric) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Avisos de presupuesto ya enviados
-- -----------------------------------------------------------------------------
create table public.ai_budget_alerts (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period       text not null check (period ~ '^(day|month):\d{4}-\d{2}(-\d{2})?$'),
  level        smallint not null check (level in (80, 100)),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, period, level)
);

alter table public.ai_budget_alerts enable row level security;
create policy ai_budget_alerts_select_admin on public.ai_budget_alerts
  for select to authenticated
  using (private.has_role(workspace_id, 'admin'));
revoke all on public.ai_budget_alerts from anon, authenticated;
grant select on public.ai_budget_alerts to authenticated;
grant all on public.ai_budget_alerts to service_role;

-- -----------------------------------------------------------------------------
-- 6. Gasto (UTC). service_role siempre; desde la app, solo owners y admins.
-- -----------------------------------------------------------------------------
create function public.ai_spend(p_workspace_id uuid)
returns table (day_usd numeric, month_usd numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.has_role(p_workspace_id, 'admin') then
    return;
  end if;
  return query
    select coalesce(sum(u.cost_usd) filter (where u.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0),
           coalesce(sum(u.cost_usd), 0)
      from public.usage_events u
     where u.workspace_id = p_workspace_id
       and u.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
end;
$$;
revoke all on function public.ai_spend(uuid) from public, anon;
grant execute on function public.ai_spend(uuid) to authenticated, service_role;

create function public.ai_spend_breakdown(p_workspace_id uuid, p_since timestamptz)
returns table (model text, task text, calls bigint, input_tokens bigint, output_tokens bigint, cost_usd numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.has_role(p_workspace_id, 'admin') then
    return;
  end if;
  return query
    select u.model, coalesce(u.task, 'other'), count(*), sum(u.input_tokens)::bigint, sum(u.output_tokens)::bigint, sum(u.cost_usd)
      from public.usage_events u
     where u.workspace_id = p_workspace_id
       and u.created_at >= p_since
     group by 1, 2
     order by 6 desc;
end;
$$;
revoke all on function public.ai_spend_breakdown(uuid, timestamptz) from public, anon;
grant execute on function public.ai_spend_breakdown(uuid, timestamptz) to authenticated, service_role;
