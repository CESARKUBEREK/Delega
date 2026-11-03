-- Onboarding con la IA primero (decisión de Cesar, 3 nov).
--
-- 1. Créditos de prueba: ya no son 50.000 tokens para el chat. Solo sirven para
--    que el onboarding prepare el plan con un modelo potente (Claude Sonnet 5.5,
--    clave de MarchaSolo en TRIAL_ANTHROPIC_API_KEY): como mucho 2 planes por
--    espacio personal, con un tope de tokens de seguridad.
-- 2. Embudo: pasos nuevos «ai» (llega al paso «Tu IA») y «ai_connected».

alter table public.workspace_trial_credits
  add column if not exists allowance_plans integer not null default 2 check (allowance_plans >= 0),
  add column if not exists used_plans integer not null default 0 check (used_plans >= 0);

-- Tope de seguridad: 2 planes de unos 10.000 tokens como mucho cada uno.
alter table public.workspace_trial_credits alter column allowance_tokens set default 30000;
update public.workspace_trial_credits set allowance_tokens = 30000 where allowance_tokens > 30000;

comment on table public.workspace_trial_credits is
  'Planes de prueba del onboarding por espacio personal (modelo potente, clave de MarchaSolo). Lectura para miembros; solo service_role escribe.';

-- Cada respuesta con la clave de prueba cuenta un plan y sus tokens (con tope).
-- Devuelve los planes que quedan.
create or replace function public.trial_consume(p_workspace_id uuid, p_tokens bigint)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.workspace_trial_credits
     set used_tokens = least(allowance_tokens, used_tokens + greatest(coalesce(p_tokens, 0), 0)),
         used_plans = least(allowance_plans, used_plans + 1),
         updated_at = now()
   where workspace_id = p_workspace_id
  returning (allowance_plans - used_plans)::bigint;
$$;
revoke all on function public.trial_consume(uuid, bigint) from public, anon, authenticated;
grant execute on function public.trial_consume(uuid, bigint) to service_role;

alter table public.onboarding_events drop constraint if exists onboarding_events_step_check;
alter table public.onboarding_events add constraint onboarding_events_step_check
  check (step in ('task', 'plan', 'ai', 'ai_connected', 'connect', 'connected', 'supervised', 'done'));
