-- =============================================================================
-- Orkesta · Migración 13 · Secreto de las tareas periódicas desde Vault
-- -----------------------------------------------------------------------------
-- mail-cron y runs-cron comparan la cabecera x-orkesta-cron con el secreto
-- «orkesta_mail_cron_secret» de Vault (el mismo que envía pg_cron). Así no hay
-- que copiarlo a mano como variable de las funciones. Solo service_role.
-- =============================================================================
create function public.cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'orkesta_mail_cron_secret' limit 1;
$$;
revoke all on function public.cron_secret() from public, anon, authenticated;
grant execute on function public.cron_secret() to service_role;
