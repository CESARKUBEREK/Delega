-- =============================================================================
-- Tests de la migración 20261110180000 (pgTAP): conexiones de asistentes (MCP, fase 11-1).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1-mcp@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'b1-mcp@test.dev', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'c1-mcp@test.dev', now());

create temp table t_ctx (k text primary key, v text);
grant select, insert, update on t_ctx to authenticated, service_role;

create function pg_temp.login(p_uid uuid, p_client text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_uid, 'role', 'authenticated')
      || case when p_client is null then '{}'::jsonb else jsonb_build_object('client_id', p_client) end)::text, true);
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

-- El owner crea una clave: se ve una vez y solo se guarda el hash.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into t_ctx select 'key', api_key from public.mcp_key_create((select v::uuid from t_ctx where k = 'org'), 'Grok Bot del Mac', array['read', 'drafts', 'inventado']);
select matches((select v from t_ctx where k = 'key'), '^ms_live_[0-9a-f]{48}$', 'la clave tiene el formato ms_live_…');
select is((select scopes from public.mcp_connections where name = 'Grok Bot del Mac'), array['read', 'drafts'],
          'los permisos se normalizan (siempre leer, nada inventado)');
select is((select key_prefix from public.mcp_connections where name = 'Grok Bot del Mac'), left((select v from t_ctx where k = 'key'), 12),
          'se guarda el prefijo visible');
select throws_ok($$ select key_hash from public.mcp_connections $$, '42501', null, 'el hash de la clave no se puede leer');
select pg_temp.logout();

-- Un miembro no crea conexiones; otro espacio no ve las de este.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.mcp_key_create((select v::uuid from t_ctx where k = 'org'), 'Mía', array['read']) $$,
                 '42501', null, 'un miembro no puede crear claves');
select is((select count(*)::int from public.mcp_connections), 0, 'un miembro no ve las conexiones');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.mcp_connections), 0, 'otro espacio no ve las conexiones');
select pg_temp.logout();

-- La función mcp encuentra la conexión por el hash de la clave.
select pg_temp.as_service();
select is((select workspace_id::text from public.mcp_resolve(encode(extensions.digest((select v from t_ctx where k = 'key'), 'sha256'), 'hex'), null, null)),
          (select v from t_ctx where k = 'org'), 'la clave lleva a su espacio');
select pg_temp.logout();

-- OAuth: la persona aprueba un cliente; al volver a aprobarlo se sustituye.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.mcp_oauth_connect((select v::uuid from t_ctx where k = 'org'), 'cliente-claude', 'Claude', array['read', 'organize']);
select throws_ok($$ select public.mcp_key_create((select v::uuid from t_ctx where k = 'org'), 'Tercera', array['read']) $$,
                 'P0001', null, 'en la prueba gratuita, como mucho 2 conexiones activas');
select public.mcp_oauth_connect((select v::uuid from t_ctx where k = 'org'), 'cliente-claude', 'Claude', array['read']);
select is((select count(*)::int from public.mcp_connections where oauth_client_id = 'cliente-claude' and revoked_at is null), 1,
          'volver a autorizar el mismo cliente deja una sola conexión activa');
select pg_temp.logout();

select pg_temp.as_service();
select is((select scopes from public.mcp_resolve(null, '00000000-0000-0000-0000-0000000000a1', 'cliente-claude')), array['read'],
          'el token OAuth lleva a la conexión vigente, con sus permisos');
select is((select count(*)::int from public.mcp_resolve(null, '00000000-0000-0000-0000-0000000000a1', 'otro-cliente')), 0,
          'otro cliente OAuth no tiene conexión');
select pg_temp.logout();

-- Un token de asistente (con client_id) no vale fuera de /mcp: la RLS no le deja ver nada.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1', 'cliente-claude');
select is((select count(*)::int from public.workspaces where id = (select v::uuid from t_ctx where k = 'org')), 0,
          'un token de asistente no ve el espacio por la API de datos');
select throws_ok($$ select public.mcp_key_create((select v::uuid from t_ctx where k = 'org'), 'Desde el asistente', array['read']) $$,
                 '42501', null, 'un token de asistente no puede crear conexiones');
select pg_temp.logout();

-- Límite por minuto (prueba gratuita: 30).
select pg_temp.as_service();
insert into public.mcp_calls (connection_id, workspace_id, tool, ok)
select c.id, c.workspace_id, 'get_today', true from public.mcp_connections c, generate_series(1, 30)
where c.name = 'Grok Bot del Mac';
select is(public.mcp_check_rate((select id from public.mcp_connections where name = 'Grok Bot del Mac')), 'rate_minute',
          'la llamada 31 del minuto se corta');
select pg_temp.logout();

-- Revocar: la clave deja de funcionar enseguida.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.mcp_connection_revoke((select id from public.mcp_connections where name = 'Grok Bot del Mac'));
select pg_temp.logout();
select pg_temp.as_service();
select is((select count(*)::int from public.mcp_resolve(encode(extensions.digest((select v from t_ctx where k = 'key'), 'sha256'), 'hex'), null, null)), 0,
          'una clave revocada no lleva a ninguna conexión');
select pg_temp.logout();

-- Si quien la creó deja de ser admin, la conexión deja de funcionar.
update public.memberships set role = 'admin'
where workspace_id = (select v::uuid from t_ctx where k = 'org') and user_id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select public.mcp_oauth_connect((select v::uuid from t_ctx where k = 'org'), 'cliente-chatgpt', 'ChatGPT', array['read']);
select pg_temp.logout();
update public.memberships set role = 'member'
where workspace_id = (select v::uuid from t_ctx where k = 'org') and user_id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.as_service();
select is((select count(*)::int from public.mcp_resolve(null, '00000000-0000-0000-0000-0000000000b1', 'cliente-chatgpt')), 0,
          'si quien la creó ya no es admin, la conexión no funciona');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select * from public.mcp_resolve(null, '00000000-0000-0000-0000-0000000000a1', 'cliente-claude') $$,
                 '42501', null, 'una persona no puede llamar a mcp_resolve');
select pg_temp.logout();

select * from finish();
rollback;
