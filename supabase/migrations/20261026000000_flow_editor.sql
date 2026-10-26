-- Editor visual de flujos (src/lib/plan-edit.ts).
--
-- Los planes ahora también se escriben a mano desde la app. La app los
-- normaliza en el servidor, pero quien edite la fila directamente (la API con
-- su sesión) podría guardar un paso que escribe o envía marcado como «sin
-- aprobación». El agente pide aprobación igualmente (lo decide la herramienta,
-- no el plan), pero el plan que se muestra tiene que decir la verdad: este
-- trigger vuelve a marcar requires_approval en esos pasos y limita a 20 pasos
-- (el tamaño ya lo limita la tabla).
create function private.flows_enforce_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.definition is null or jsonb_typeof(new.definition -> 'steps') <> 'array' then
    return new;
  end if;
  if jsonb_array_length(new.definition -> 'steps') > 20 then
    raise exception 'Como mucho 20 pasos' using errcode = '22023';
  end if;
  new.definition := jsonb_set(
    new.definition,
    '{steps}',
    coalesce((
      select jsonb_agg(
        case
          when jsonb_typeof(s) = 'object'
               and (s ->> 'kind' = 'write' or (s ->> 'kind' = 'notify' and coalesce(s ->> 'connection', 'none') <> 'none'))
            then s || '{"requires_approval": true}'::jsonb
          else s
        end
        order by ord)
      from jsonb_array_elements(new.definition -> 'steps') with ordinality as e(s, ord)
    ), '[]'::jsonb)
  );
  return new;
end;
$$;
revoke all on function private.flows_enforce_approval() from public, anon, authenticated;

create trigger flows_enforce_approval
  before insert or update of definition on public.flows
  for each row execute function private.flows_enforce_approval();
