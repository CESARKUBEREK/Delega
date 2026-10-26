begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f1', 'wa@test.dev', now());

select lives_ok(
  $$ insert into public.integrations (workspace_id, provider, status, vault_secret_id)
     values ((select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000f1'), 'whatsapp', 'active', vault.create_secret('x')) $$,
  'WhatsApp es un proveedor de integración válido');

select ok(
  public.inbox_record_message(
    (select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000f1'),
    null, 'whatsapp', '+34600111222', 'SM0001', 'in', 'Ana', '+34600111222', '', '', 'Hola, ¿tenéis cita el lunes?',
    now(), 'Ana', '+34600111222') is not null,
  'un WhatsApp entra en la bandeja');

select is((select channel from public.inbox_threads where external_id = '+34600111222'), 'whatsapp', 'la conversación es del canal WhatsApp');

select throws_ok(
  $$ insert into public.integrations (workspace_id, provider, status, vault_secret_id)
     values ((select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000f1'), 'signal', 'active', vault.create_secret('y')) $$,
  '23514', null, 'un proveedor desconocido se rechaza');

select * from finish();
rollback;
