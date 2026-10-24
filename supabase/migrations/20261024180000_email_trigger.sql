-- =============================================================================
-- Orkesta · Migración 9 · Disparador «al llegar un correo» y ejecuciones en
-- segundo plano
-- -----------------------------------------------------------------------------
-- * Las automatizaciones con disparador "email_message" se lanzan al leer el
--   buzón IMAP (mail-cron, inbox-sync). Sus filtros se guardan en
--   flows.settings.email_filter (sin cambios de esquema).
-- * runs-cron avanza cada minuto las ejecuciones que nadie está mirando.
-- Solo índices para esas dos búsquedas.
-- =============================================================================

-- Automatizaciones activas de un espacio por tipo de disparador.
create index flows_active_trigger_idx
  on public.flows (workspace_id, ((definition -> 'trigger' ->> 'type')))
  where status = 'active';

-- Ejecuciones en marcha, de la más antigua a la más reciente.
create index flow_runs_running_idx
  on public.flow_runs (updated_at)
  where status = 'running';

-- Límite por hora de ejecuciones lanzadas por correo o Telegram.
create index flow_runs_trigger_started_idx
  on public.flow_runs (workspace_id, ((trigger ->> 'type')), started_at desc);
