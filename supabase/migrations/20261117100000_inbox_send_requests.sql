-- Fase 6H-2: envíos manuales de la bandeja que no se repiten.
-- El compositor manda un request_id por borrador. inbox-reply lo reserva aquí
-- antes de enviar: si el mismo request_id llega dos veces (doble clic, refresco,
-- reintento tras un tiempo agotado), el segundo no envía nada.
-- Solo la usa service_role desde la Edge Function: sin acceso para la app.

create table public.inbox_send_requests (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id   uuid not null,
  thread_id    uuid not null,
  status       text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  primary key (workspace_id, request_id),
  constraint inbox_send_requests_thread_workspace_fkey
    foreign key (thread_id, workspace_id)
    references public.inbox_threads(id, workspace_id) on delete cascade
);

create index inbox_send_requests_thread_idx on public.inbox_send_requests(workspace_id, thread_id);

alter table public.inbox_send_requests enable row level security;
revoke all on table public.inbox_send_requests from anon, authenticated;
