begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(vault.create_secret('s'||repeat('x', 40), 'orkesta_mail_cron_secret') is not null, 'secreto de prueba en Vault');
set local role service_role;
select is(public.cron_secret(), 's'||repeat('x', 40), 'service_role lee el secreto de las tareas periódicas');
reset role;
set local role authenticated;
select throws_ok($$ select public.cron_secret() $$, '42501', null, 'un usuario no puede leerlo');
reset role;
set local role anon;
select throws_ok($$ select public.cron_secret() $$, '42501', null, 'anon tampoco');
reset role;

select * from finish();
rollback;
