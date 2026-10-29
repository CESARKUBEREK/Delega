-- MarchaSolo: Grok (xAI) como proveedor de IA y Buffer (redes sociales) como
-- integración del espacio. La clave de Buffer se guarda en Vault mediante
-- integration_save, igual que las demás.

alter table public.ai_connections drop constraint ai_connections_provider_check;
alter table public.ai_connections
  add constraint ai_connections_provider_check check (provider in ('openai', 'anthropic', 'deepseek', 'xai'));

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap', 'tokko', 'xubio', 'whatsapp', 'supabase', 'custom_1', 'custom_2', 'buffer'));
