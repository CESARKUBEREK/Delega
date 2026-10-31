-- Google Contacts (People API) para quien no usa un CRM: buscar contactos y
-- crearlos con aprobación. Conexión OAuth propia (provider "contacts"), como
-- Calendar.

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'contacts', 'hubspot', 'imap', 'tokko', 'xubio', 'whatsapp', 'supabase', 'custom_1', 'custom_2', 'buffer', 'grok_voice'));

alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check check (provider in ('google', 'calendar', 'contacts'));
