begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000ab', 'ab@test.dev', now());
create temp table t_ctx (k text primary key, v text);
grant select, insert on t_ctx to authenticated, service_role;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000ab', 'role', 'authenticated')::text, true) is not null as login \gset
set local role authenticated;
insert into t_ctx values ('org', public.create_organization('Inmobiliaria')::text);
reset role;

set local role service_role;
select lives_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'tokko', 'abc123abc123abc123abc123', 'Tokko Broker', '', null) $$,
                'se guarda una conexión de Tokko');
select lives_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'xubio', '{"client_id":"a","secret_id":"b"}', 'Xubio', '', null) $$,
                'se guarda una conexión de Xubio');
select throws_ok($$ select public.integration_save((select v::uuid from t_ctx where k = 'org'), 'colppy', 'abc123abc123abc123abc123', 'x', '', null) $$,
                 '23514', null, 'otros proveedores no se admiten');
reset role;

select * from finish();
rollback;
