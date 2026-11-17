-- Envíos manuales sin repetición (migración 20261117095107, fase 6H-2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.dev', now());
create temp table t_ws as
  select id from public.workspaces where personal_owner = '00000000-0000-0000-0000-0000000000e1';
insert into public.inbox_threads (workspace_id, channel, external_id)
  select id, 'email', 'imap:test-6h2' from t_ws;
create temp table t_th as
  select id from public.inbox_threads where external_id = 'imap:test-6h2';

insert into public.inbox_send_requests (workspace_id, request_id, thread_id)
  select (select id from t_ws), '00000000-0000-0000-0000-00000000aaaa', (select id from t_th);

select throws_ok(
  $$insert into public.inbox_send_requests (workspace_id, request_id, thread_id)
    select (select id from t_ws), '00000000-0000-0000-0000-00000000aaaa', (select id from t_th)$$,
  '23505', null, 'el mismo request_id no se puede reservar dos veces');
select throws_ok(
  $$update public.inbox_send_requests set status = 'enviado'$$,
  '23514', null, 'status solo admite sending, sent o failed');

-- Las tablas temporales sí se pueden leer: así el 42501 viene de la tabla real.
grant select on t_ws, t_th to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select count(*) from public.inbox_send_requests$$,
  '42501', null, 'la app no puede leer las reservas de envío');
select throws_ok(
  $$insert into public.inbox_send_requests (workspace_id, request_id, thread_id)
    select (select id from t_ws), gen_random_uuid(), (select id from t_th)$$,
  '42501', null, 'la app no puede reservar envíos directamente');
reset role;

select * from finish();
rollback;
