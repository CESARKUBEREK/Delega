-- =============================================================================
-- Tests de la migración 20261110120000 (pgTAP): páginas vivas (fase 10-1).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1-pages@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b1-pages@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c1-pages@test.dev', now());

create temp table t_ctx (k text primary key, v text);
grant select, insert, update on t_ctx to authenticated, service_role;

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- a1: owner. b1: miembro del mismo espacio. c1: owner de otro espacio.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into t_ctx values ('org', public.create_organization('Inmobiliaria Norte')::text);
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
insert into t_ctx values ('other', public.create_organization('Otra')::text);
select pg_temp.logout();
insert into public.memberships (workspace_id, user_id, role)
values ((select v::uuid from t_ctx where k = 'org'), '00000000-0000-0000-0000-0000000000b1', 'member');

-- Una ejecución crea la página (service_role) y luego la actualiza.
select pg_temp.as_service();
insert into public.flow_runs (id, workspace_id, flow_name, plan, status)
values ('00000000-0000-0000-0000-00000000f001', (select v::uuid from t_ctx where k = 'org'), 'Informe', '{}'::jsonb, 'running');
insert into public.pages (id, workspace_id, title, slug, content_md, updated_by_run)
values ('00000000-0000-0000-0000-00000000aa01', (select v::uuid from t_ctx where k = 'org'), 'Informe Corrientes 1234',
        'informe-corrientes-1234', E'## Resumen\n3 consultas', '00000000-0000-0000-0000-00000000f001');
select is((select count(*)::int from public.page_versions where page_id = '00000000-0000-0000-0000-00000000aa01'), 1,
          'crear la página deja la primera versión');
select is((select flow_run_id::text from public.page_versions where page_id = '00000000-0000-0000-0000-00000000aa01'),
          '00000000-0000-0000-0000-00000000f001', 'la versión guarda la ejecución que la produjo');
update public.pages set content_md = E'## Resumen\n4 consultas' where id = '00000000-0000-0000-0000-00000000aa01';
update public.pages set source_ref = '{"tokko_property_id": "77"}' where id = '00000000-0000-0000-0000-00000000aa01';
select is((select count(*)::int from public.page_versions where page_id = '00000000-0000-0000-0000-00000000aa01'), 2,
          'solo los cambios de contenido dejan versión');
select pg_temp.logout();

-- El owner la ve, la edita a mano y la edición queda a su nombre.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.pages), 1, 'un owner ve las páginas de su espacio');
select lives_ok($$ update public.pages set content_md = E'## Resumen\n4 consultas (revisado)'
                   where id = '00000000-0000-0000-0000-00000000aa01' $$, 'un owner edita una página a mano');
select is((select edited_by::text from public.page_versions where page_id = '00000000-0000-0000-0000-00000000aa01' order by id desc limit 1),
          '00000000-0000-0000-0000-0000000000a1', 'la edición a mano queda a nombre de quien la hizo');
select throws_ok($$ update public.pages set updated_by_run = null where id = '00000000-0000-0000-0000-00000000aa01' $$,
                 '42501', null, 'a mano no se puede cambiar la ejecución que la actualizó');
select throws_ok($$ insert into public.pages (workspace_id, title, slug) values
                    ((select v::uuid from t_ctx where k = 'org'), 'Mal', 'Con Espacios') $$,
                 '23514', null, 'el slug tiene que ser válido');
select pg_temp.logout();

-- Un miembro no ve ni páginas ni versiones.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.pages), 0, 'un miembro no ve las páginas');
select is((select count(*)::int from public.page_versions), 0, 'un miembro no ve las versiones');
select pg_temp.logout();

-- El owner de otro espacio, tampoco.
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.pages), 0, 'otro espacio no ve las páginas');
select pg_temp.logout();

-- Se guardan como mucho 50 versiones.
select pg_temp.as_service();
do $$
begin
  for i in 1..60 loop
    update public.pages set content_md = '## Resumen' || chr(10) || i::text where id = '00000000-0000-0000-0000-00000000aa01';
  end loop;
end $$;
select is((select count(*)::int from public.page_versions where page_id = '00000000-0000-0000-0000-00000000aa01'), 50,
          'se guardan las 50 últimas versiones');
select pg_temp.logout();

select * from finish();
rollback;
