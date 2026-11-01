-- Créditos de IA de prueba (decisión de Cesar, 1 nov): con una clave de
-- MarchaSolo (DeepSeek Flash), solo para el chat y el onboarding, 50.000
-- tokens (entrada + salida) por espacio personal. La clave vive solo en los
-- secretos de las Edge Functions (TRIAL_LLM_API_KEY).
create table public.workspace_trial_credits (
  workspace_id     uuid primary key references public.workspaces (id) on delete cascade,
  allowance_tokens bigint not null default 50000 check (allowance_tokens >= 0),
  used_tokens      bigint not null default 0 check (used_tokens >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.workspace_trial_credits is
  'Tokens de IA de prueba por espacio personal. Lectura para miembros; solo service_role escribe.';

alter table public.workspace_trial_credits enable row level security;

create policy workspace_trial_credits_select_member on public.workspace_trial_credits
  for select to authenticated
  using (private.is_member(workspace_id));

revoke all on public.workspace_trial_credits from anon, authenticated;
grant select on public.workspace_trial_credits to authenticated;
grant all on public.workspace_trial_credits to service_role;

-- Alta al crear un espacio personal (uno por cuenta: crear espacios de equipo
-- no da más créditos).
create function private.grant_trial_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'personal' then
    insert into public.workspace_trial_credits (workspace_id) values (new.id)
    on conflict (workspace_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.grant_trial_credits() from public, anon, authenticated;

create trigger workspaces_grant_trial
  after insert on public.workspaces
  for each row execute function private.grant_trial_credits();

-- Apunta lo gastado tras cada llamada. Siempre suma (con tope en el máximo):
-- si una llamada se pasa del saldo, el saldo queda a cero y no hay más.
-- Devuelve los tokens que quedan.
create function public.trial_consume(p_workspace_id uuid, p_tokens bigint)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.workspace_trial_credits
     set used_tokens = least(allowance_tokens, used_tokens + greatest(coalesce(p_tokens, 0), 0)),
         updated_at = now()
   where workspace_id = p_workspace_id
  returning allowance_tokens - used_tokens;
$$;
revoke all on function public.trial_consume(uuid, bigint) from public, anon, authenticated;
grant execute on function public.trial_consume(uuid, bigint) to service_role;

-- Espacios personales que ya existen.
insert into public.workspace_trial_credits (workspace_id)
select id from public.workspaces where kind = 'personal'
on conflict (workspace_id) do nothing;
