-- =============================================================================
-- Orkesta · Migración 7 · Correo IMAP/SMTP
-- -----------------------------------------------------------------------------
-- * integrations admite 'imap': un buzón de correo de hosting (OVH, IONOS,
--   Hostinger…) por espacio. Usuario y contraseña van cifrados en Vault, como
--   JSON; en `config` solo hay datos no secretos (dirección, servidores,
--   carpeta de enviados y por dónde va la lectura: uid_validity y last_uid).
-- * La bandeja no cambia: los correos IMAP entran con channel = 'email' y su
--   identificador lleva el prefijo «imap:», así que no chocan con los de Gmail.
-- =============================================================================

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations
  add constraint integrations_provider_check
  check (provider in ('google', 'gmail', 'telegram', 'calendar', 'hubspot', 'imap'));

-- Integraciones de correo activas, para la lectura automática (solo service_role).
create function public.mail_integrations_due(p_limit int default 20)
returns table (workspace_id uuid, provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.workspace_id, i.provider
  from public.integrations i
  where i.provider in ('gmail', 'imap') and i.status = 'active'
  order by coalesce((i.config ->> 'last_sync_at')::timestamptz, 'epoch'::timestamptz)
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
revoke all on function public.mail_integrations_due(int) from public, anon, authenticated;
grant execute on function public.mail_integrations_due(int) to service_role;
