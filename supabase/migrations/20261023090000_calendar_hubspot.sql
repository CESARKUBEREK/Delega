-- =============================================================================
-- Delega · Migración 5 · Google Calendar y HubSpot
-- -----------------------------------------------------------------------------
-- * integrations admite 'calendar' (OAuth de Google con calendar.events y
--   calendar.calendarlist.readonly; refresh token en Vault) y 'hubspot'
--   (clave de servicio o token de app privada en Vault).
-- * oauth_states admite 'calendar'.
-- Google Drive no necesita cambios: los archivos y carpetas elegidos se
-- guardan en integration_files con su mime_type.
-- =============================================================================

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'gmail', 'telegram', 'calendar', 'hubspot'));

alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check check (provider in ('google', 'gmail', 'calendar'));
