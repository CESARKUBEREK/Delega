-- =============================================================================
-- Orkesta · Migración 11 · Tokko Broker y Xubio
-- -----------------------------------------------------------------------------
-- * 'tokko': clave de API de la inmobiliaria (en Vault). Lectura de propiedades
--   y emprendimientos; registrar consultas en su CRM, con aprobación.
-- * 'xubio': Client ID y Secret ID (JSON en Vault). Solo lectura de clientes,
--   proveedores, productos y comprobantes.
-- =============================================================================
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'telegram', 'calendar', 'hubspot', 'imap', 'tokko', 'xubio'));
