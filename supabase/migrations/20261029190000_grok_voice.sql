-- MarchaSolo: atención telefónica con Grok Voice (xAI).
-- * integrations admite 'grok_voice': su secreto (en Vault) es la clave del
--   servidor MCP del espacio; config guarda horario de citas y documentos.
-- * La bandeja admite el canal 'phone': citas y recados de las llamadas.
-- Va después de 20261029180000_grok_buffer.sql.

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap', 'tokko', 'xubio', 'whatsapp', 'supabase', 'custom_1', 'custom_2', 'buffer', 'grok_voice'));

alter table public.inbox_threads drop constraint inbox_threads_channel_check;
alter table public.inbox_threads
  add constraint inbox_threads_channel_check check (channel in ('email', 'telegram', 'whatsapp', 'phone'));

alter table public.inbox_messages drop constraint inbox_messages_channel_check;
alter table public.inbox_messages
  add constraint inbox_messages_channel_check check (channel in ('email', 'telegram', 'whatsapp', 'phone'));
