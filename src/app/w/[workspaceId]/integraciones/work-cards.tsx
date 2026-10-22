import { createClient } from "@/lib/supabase/server"
import { connectGoogle } from "../run-actions"
import { DisconnectInboxForm, HubSpotForm } from "./inbox-client"

function Badge({ status, invalidLabel }: { status: string | null | undefined; invalidLabel: string }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status) return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">{invalidLabel}</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}

export async function CalendarCard({ workspaceId, isAdmin, notice }: { workspaceId: string; isAdmin: boolean; notice: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "calendar")
    .maybeSingle()
  const tz = ((integration?.config ?? {}) as { timezone?: string }).timezone

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h2 className="rotulo text-lg">Google Calendar</h2>
          <p className="text-sm text-graphite">
            Las automatizaciones consultan tu agenda y proponen eventos nuevos o cambios. Nada se crea ni se mueve sin tu aprobación.
          </p>
        </div>
        <Badge status={integration?.status} invalidLabel="Acceso retirado" />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {notice ? (
          <p role="status" className="border-l-2 border-ok bg-ok-bg px-3 py-2 text-sm text-ok">
            Google Calendar conectado.
          </p>
        ) : null}

        {integration ? (
          <p className="text-sm text-graphite">
            Calendario principal de <span className="font-medium text-ink">{integration.account_email ?? "tu cuenta"}</span>
            {tz ? `, zona ${tz}` : ""}.{" "}
            {integration.status === "active"
              ? "Las invitaciones a terceros solo se envían a tus contactos autorizados."
              : "Google retiró el acceso (en modo pruebas ocurre cada 7 días): vuelve a conectar."}
          </p>
        ) : (
          <p className="text-sm text-graphite">Google te pedirá permiso para ver y editar los eventos de tus calendarios.</p>
        )}

        {isAdmin ? (
          <>
            {integration?.status !== "active" ? (
              <form action={connectGoogle}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="product" value="calendar" />
                <button type="submit" className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90">
                  {integration ? "Volver a conectar Calendar" : "Conectar Google Calendar"}
                </button>
              </form>
            ) : null}
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="calendar" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar Google Calendar.</p>
        )}
      </div>
    </section>
  )
}

export async function HubSpotCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "hubspot")
    .maybeSingle()
  const config = (integration?.config ?? {}) as { portal_id?: number | null }

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h2 className="rotulo text-lg">HubSpot</h2>
          <p className="text-sm text-graphite">
            Contactos, empresas y negocios de tu CRM. Las automatizaciones buscan y leen; crear, actualizar, mover etapas,
            añadir notas o tareas espera tu aprobación.
          </p>
        </div>
        <Badge status={integration?.status} invalidLabel="Clave rechazada" />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            {config.portal_id ? (
              <a
                href={`https://app.hubspot.com/contacts/${config.portal_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink underline underline-offset-4"
              >
                {integration.account_email}
              </a>
            ) : (
              <span className="font-medium text-ink">{integration.account_email}</span>
            )}{" "}
            conectada.
          </p>
        ) : null}

        {isAdmin ? (
          <>
            <HubSpotForm workspaceId={workspaceId} replacing={Boolean(integration)} />
            <details className="text-sm text-graphite" open={!integration}>
              <summary className="cursor-pointer text-ink">Cómo consigo la clave</summary>
              <ol className="mt-2 list-decimal pl-5">
                <li>En HubSpot, abre Desarrollo → Claves → Claves de servicio y pulsa «Crear clave de servicio».</li>
                <li>
                  Ponle de nombre «Delega» y añade estos permisos: <span className="font-mono text-xs">crm.objects.contacts</span>,{" "}
                  <span className="font-mono text-xs">crm.objects.companies</span> y <span className="font-mono text-xs">crm.objects.deals</span>, cada uno
                  de lectura y escritura.
                </li>
                <li>Crea la clave, cópiala y pégala aquí. Solo la ve quien la crea; en Delega queda cifrada.</li>
              </ol>
              <p className="mt-2">
                Si tu cuenta aún permite apps privadas (hasta el 26 de octubre de 2026 en cuentas existentes), su token también sirve.
              </p>
            </details>
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="hubspot" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar HubSpot.</p>
        )}
      </div>
    </section>
  )
}
