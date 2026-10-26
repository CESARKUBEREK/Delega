-- WhatsApp como canal (a través de Twilio; ver supabase/functions/_shared/whatsapp.ts).
--
-- * integrations: nuevo proveedor "whatsapp" (Account SID, Auth Token y número
--   remitente en Vault, como el resto de credenciales).
-- * Bandeja: nuevo canal "whatsapp" en conversaciones y mensajes. La
--   conversación se identifica por el número del cliente (+34600111222).
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap', 'tokko', 'xubio', 'whatsapp'));

alter table public.inbox_threads drop constraint inbox_threads_channel_check;
alter table public.inbox_threads
  add constraint inbox_threads_channel_check check (channel in ('email', 'telegram', 'whatsapp'));

alter table public.inbox_messages drop constraint inbox_messages_channel_check;
alter table public.inbox_messages
  add constraint inbox_messages_channel_check check (channel in ('email', 'telegram', 'whatsapp'));
