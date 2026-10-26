begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000e1', 'editor@test.dev', now());

insert into public.flows (id, workspace_id, name, definition, created_by)
values ('00000000-0000-0000-0000-0000000000e3',
  (select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000e1'), 'Prueba',
  '{"version":1,"name":"Prueba","steps":[
     {"id":"s1","kind":"write","connection":"spreadsheet","requires_approval":false},
     {"id":"s2","kind":"notify","connection":"email","requires_approval":false},
     {"id":"s3","kind":"notify","connection":"none","requires_approval":false},
     {"id":"s4","kind":"read","connection":"calendar","requires_approval":false}]}',
  '00000000-0000-0000-0000-0000000000e1');

select is((select definition #>> '{steps,0,requires_approval}' from public.flows where id = '00000000-0000-0000-0000-0000000000e3'), 'true', 'escribir siempre pide aprobación');
select is((select definition #>> '{steps,1,requires_approval}' from public.flows where id = '00000000-0000-0000-0000-0000000000e3'), 'true', 'enviar a otros siempre pide aprobación');
select is((select definition #>> '{steps,2,requires_approval}' from public.flows where id = '00000000-0000-0000-0000-0000000000e3'), 'false', 'avisarse a uno mismo no la pide');

update public.flows set definition = jsonb_set(definition, '{steps,0,requires_approval}', 'false') where id = '00000000-0000-0000-0000-0000000000e3';
select is((select definition #>> '{steps,0,requires_approval}' from public.flows where id = '00000000-0000-0000-0000-0000000000e3'), 'true', 'tampoco se puede quitar al editar');

select throws_ok(
  $$ update public.flows set definition = jsonb_build_object('steps', (select jsonb_agg(jsonb_build_object('kind','read')) from generate_series(1, 21)))
     where id = '00000000-0000-0000-0000-0000000000e3' $$,
  '22023', null, 'más de 20 pasos se rechaza');

select * from finish();
rollback;
