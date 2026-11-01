-- Onboarding terminado, por espacio (no por navegador). No obliga a conectar
-- nada: solo evita que /abrir vuelva a mandar al onboarding.
alter table public.workspaces
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.workspaces.onboarding_completed_at is
  'Cuándo un admin terminó el onboarding. Null = aún no.';

-- authenticated solo puede actualizar workspaces.name, así que se marca con
-- esta función: solo admins y owners, con la hora del servidor y sin pisar la
-- primera fecha. Devuelve false si quien llama no administra el espacio.
create function public.workspace_complete_onboarding(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_workspace_id, 'admin') then
    return false;
  end if;
  update public.workspaces
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = p_workspace_id;
  return true;
end;
$$;
revoke all on function public.workspace_complete_onboarding(uuid) from public, anon;
grant execute on function public.workspace_complete_onboarding(uuid) to authenticated, service_role;
