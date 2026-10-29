-- Marcha Solo: habilita Supabase y dos conexiones REST configurables por espacio.
-- Los secretos se guardan en Vault mediante integration_save; config solo guarda metadatos.
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap', 'tokko', 'xubio', 'whatsapp', 'supabase', 'custom_1', 'custom_2'));
