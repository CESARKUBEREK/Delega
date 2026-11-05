import { ExternalLink } from "@/components/external-link"
import { IntegrationStatusBadge } from "@/components/ui"
import { PROVIDER_LINKS } from "@/lib/provider-links"
import { fileKindLabel } from "@/lib/plan"
import { supabaseUrl } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { playbook, readVoiceConfig } from "@/lib/voice"
import { connectGoogle } from "../run-actions"
import { BufferForm, DisconnectInboxForm, HubSpotForm, TokkoForm, XubioForm } from "./inbox-client"
import { DisconnectVoiceForm, VoiceAccess, VoicePlaybook, VoiceSettingsForm } from "./voice-client"
import { VoiceWebPanel, type VoiceWebWidget } from "./voice-web-client"



function integrationStatus(status: string | null | undefined, unconfigured: "available" | "setup" = "available") {
  if (!status) return unconfigured
  if (status === "active") return "connected"
  return status === "paused" ? "setup" : "attention"
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
    <details data-help="calendar" data-integration-icon="calendar" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Google Calendar</h3>
          <p className="text-sm text-graphite">
            Las automatizaciones consultan tu agenda y proponen eventos nuevos o cambios. Nada se crea ni se mueve sin tu aprobación.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Acceso retirado" />
      </summary>

      <div className="flex flex-col gap-5 px-5 py-5">
        {notice ? (
          <p role="status" className="integration-notice is-success border-l-2 px-3 py-2 text-sm">
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
    </details>
  )
}

export async function ContactsCard({ workspaceId, isAdmin, notice }: { workspaceId: string; isAdmin: boolean; notice: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "contacts")
    .maybeSingle()

  return (
    <details data-help="contacts" data-integration-icon="contacts" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Google Contacts</h3>
          <p className="text-sm text-graphite">
            Para quien no usa un CRM: las automatizaciones buscan a tus clientes en tus contactos de Google y proponen dar de alta a los nuevos. Nada se crea sin tu
            aprobación.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Acceso retirado" />
      </summary>

      <div className="flex flex-col gap-5 px-5 py-5">
        {notice ? (
          <p role="status" className="integration-notice is-success border-l-2 px-3 py-2 text-sm">
            Google Contacts conectado.
          </p>
        ) : null}

        {integration ? (
          <p className="text-sm text-graphite">
            Contactos de <span className="font-medium text-ink">{integration.account_email ?? "tu cuenta"}</span>.{" "}
            {integration.status === "active"
              ? "La bandeja reconoce a estas personas como contactos y les prepara la respuesta al llegar su correo."
              : "Google retiró el acceso (en modo pruebas ocurre cada 7 días): vuelve a conectar."}
          </p>
        ) : (
          <p className="text-sm text-graphite">Google te pedirá permiso para ver y crear contactos en tu cuenta.</p>
        )}

        {isAdmin ? (
          <>
            {integration?.status !== "active" ? (
              <form action={connectGoogle}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="product" value="contacts" />
                <button type="submit" className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90">
                  {integration ? "Volver a conectar Contacts" : "Conectar Google Contacts"}
                </button>
              </form>
            ) : null}
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="contacts" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar Google Contacts.</p>
        )}
      </div>
    </details>
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
    <details data-help="hubspot" data-integration-icon="hubspot" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">HubSpot</h3>
          <p className="text-sm text-graphite">
            Contactos, empresas y negocios de tu CRM. Las automatizaciones buscan y leen; crear, actualizar, mover etapas,
            añadir notas o tareas espera tu aprobación.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Clave rechazada" />
      </summary>

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
              <div className="external-links mt-2">
                <ExternalLink link={PROVIDER_LINKS.hubspot} compact />
                <ExternalLink link={PROVIDER_LINKS.hubspotEu} compact />
              </div>
              <ol className="mt-2 list-decimal pl-5">
                <li>Entra en HubSpot (si tu cuenta está en Europa, con el segundo botón). Abre Desarrollo → Claves → Claves de servicio y pulsa «Crear clave de servicio».</li>
                <li>
                  Ponle de nombre «MarchaSolo» y añade estos permisos: <span className="font-mono text-xs">crm.objects.contacts</span>,{" "}
                  <span className="font-mono text-xs">crm.objects.companies</span> y <span className="font-mono text-xs">crm.objects.deals</span>, cada uno
                  de lectura y escritura.
                </li>
                <li>Crea la clave, cópiala y pégala aquí. Solo la ve quien la crea; en MarchaSolo queda cifrada.</li>
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
    </details>
  )
}

export async function TokkoCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "tokko")
    .maybeSingle()

  return (
    <details data-help="tokko" data-integration-icon="tokko" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Tokko Broker</h3>
          <p className="text-sm text-graphite">
            Tu cartera de propiedades y emprendimientos. Las automatizaciones buscan y leen fichas; registrar una consulta en el CRM de
            Tokko espera tu aprobación.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Clave rechazada" />
      </summary>
      <div className="flex flex-col gap-5 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            <span className="font-medium text-ink">{integration.account_email}</span> conectado.
          </p>
        ) : null}
        {isAdmin ? (
          <>
            <TokkoForm workspaceId={workspaceId} replacing={Boolean(integration)} />
            <details className="text-sm text-graphite" open={!integration}>
              <summary className="cursor-pointer text-ink">Cómo consigo la clave</summary>
              <div className="mt-2">
                <ExternalLink link={PROVIDER_LINKS.tokko} compact />
              </div>
              <ol className="mt-2 list-decimal pl-5">
                <li>Entra en Tokko Broker con un usuario administrador.</li>
                <li>Abre «Mi empresa» → «Permisos» y copia la clave de API («API Key»).</li>
                <li>Pégala aquí. Da acceso a tus propiedades, emprendimientos y al registro de consultas.</li>
              </ol>
            </details>
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="tokko" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar Tokko.</p>
        )}
      </div>
    </details>
  )
}

export async function XubioCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "xubio")
    .maybeSingle()

  return (
    <details data-help="xubio" data-integration-icon="xubio" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Xubio</h3>
          <p className="text-sm text-graphite">
            Tu contabilidad: clientes, proveedores, productos y facturas de venta y de compra. Por ahora solo lectura: MarchaSolo no crea
            facturas ni cobros.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Credenciales rechazadas" />
      </summary>
      <div className="flex flex-col gap-5 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            <span className="font-medium text-ink">{integration.account_email}</span> conectado.
          </p>
        ) : null}
        {isAdmin ? (
          <>
            <XubioForm workspaceId={workspaceId} replacing={Boolean(integration)} />
            <details className="text-sm text-graphite" open={!integration}>
              <summary className="cursor-pointer text-ink">Cómo consigo las credenciales</summary>
              <div className="mt-2">
                <ExternalLink link={PROVIDER_LINKS.xubio} compact />
              </div>
              <ol className="mt-2 list-decimal pl-5">
                <li>Entra en Xubio y abre «Configuración» → «Integraciones» → «API de Xubio».</li>
                <li>Pulsa «Nueva App Cliente», ponle de nombre «MarchaSolo» y guarda.</li>
                <li>Copia el Client ID y el Secret ID y pégalos aquí.</li>
              </ol>
              <p className="mt-2">La API solo está en los planes de Xubio que la incluyen (emprendedores y empresas).</p>
            </details>
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="xubio" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar Xubio.</p>
        )}
      </div>
    </details>
  )
}

export async function BufferCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "buffer")
    .maybeSingle()

  return (
    <details data-help="buffer" data-integration-icon="buffer" data-integration-status={integrationStatus(integration?.status)} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Buffer</h3>
          <p className="text-sm text-graphite">
            Tus redes sociales (Instagram, Facebook, LinkedIn, X, TikTok…) a través de Buffer. MarchaSolo redacta publicaciones y las
            añade a la cola o las programa; cada publicación espera tu aprobación.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Clave rechazada" />
      </summary>
      <div className="flex flex-col gap-5 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            <span className="font-medium text-ink">{integration.account_email}</span> conectado.
          </p>
        ) : null}
        {isAdmin ? (
          <>
            <BufferForm workspaceId={workspaceId} replacing={Boolean(integration)} />
            <details className="text-sm text-graphite" open={!integration}>
              <summary className="cursor-pointer text-ink">Cómo consigo la clave</summary>
              <div className="mt-2">
                <ExternalLink link={PROVIDER_LINKS.buffer} compact />
              </div>
              <ol className="mt-2 list-decimal pl-5">
                <li>Entra en Buffer con tu cuenta (el botón abre directamente «Settings» → «API»). Conecta allí tus redes sociales si aún no lo has hecho.</li>
                <li>En la pestaña «Personal Access», pulsa «+ New Key», ponle de nombre «MarchaSolo» y copia la clave.</li>
                <li>Pégala aquí. Da acceso a todos los canales de tu cuenta de Buffer. El plan gratuito de Buffer incluye la API.</li>
              </ol>
              <p className="mt-2">Por ahora, MarchaSolo publica solo texto: las imágenes y los vídeos se añaden desde Buffer.</p>
            </details>
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="buffer" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar Buffer.</p>
        )}
      </div>
    </details>
  )
}

// Asistente de voz: datos comunes a la web y al teléfono.
async function voiceData(workspaceId: string) {
  const supabase = await createClient()
  const [{ data: integration }, { data: calendar }, { data: rawFiles }, { data: ws }, { data: widget }, { data: xai }] = await Promise.all([
    supabase.from("integrations").select("status, config").eq("workspace_id", workspaceId).eq("provider", "grok_voice").maybeSingle(),
    supabase.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "calendar").maybeSingle(),
    supabase.from("integration_files").select("id, name, mime_type").eq("workspace_id", workspaceId).order("name").limit(100),
    supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("voice_web_widgets")
      .select("public_id, enabled, title, sessions_per_day, minutes_per_session, allowed_domains")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId).eq("provider", "xai").maybeSingle(),
  ])
  const files = (rawFiles ?? [])
    .filter((f) => f.mime_type !== "application/vnd.google-apps.folder")
    .map((f) => ({ id: f.id, name: f.name, kind: fileKindLabel(f.mime_type).toLowerCase() }))
  return { integration, calendar, files, ws, widget: (widget as VoiceWebWidget | null) ?? null, xaiReady: xai?.status === "active", config: readVoiceConfig(integration?.config) }
}

function CalendarWarning() {
  return (
    <p className="integration-notice is-info border-l-2 px-3 py-2 text-sm">
      Conecta Google Calendar (más abajo, en Calendar) para que el asistente pueda ver huecos y reservar citas. Sin él, solo toma recados.
    </p>
  )
}

// Asistente de voz en la web del cliente: lo más visible del bloque.
export async function VoiceWebCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { integration, calendar, widget, xaiReady } = await voiceData(workspaceId)
  const ready = Boolean(widget?.enabled && xaiReady)
  return (
    <details data-help="voice-web" data-integration-icon="voice" data-integration-status={ready ? "connected" : "setup"} name="integrations" className="integration-accordion border border-ink bg-sheet" open={Boolean(isAdmin && !widget)}>
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">En tu web</h3>
          <p className="text-sm text-graphite">
            Un botón «Habla con nosotros» en tu web: tus clientes hablan con el asistente desde el navegador, sin llamar. Pide citas en tu horario, toma
            recados y responde con tus documentos. Todo llega a la Bandeja.
          </p>
        </div>
        {widget?.enabled && !xaiReady ? (
          <span className="integration-state-setup shrink-0 border px-2 py-0.5 text-xs">Conecta Grok</span>
        ) : (
          <IntegrationStatusBadge status={widget ? (widget.enabled ? "active" : "paused") : null} invalidLabel="Sin activar" />
        )}
      </summary>
      <div className="flex flex-col gap-5 px-5 py-5">
        {!isAdmin ? (
          <p className="text-sm text-graphite">Solo un administrador puede configurar el asistente de voz.</p>
        ) : (
          <>
            {calendar?.status !== "active" ? <CalendarWarning /> : null}
            <VoiceWebPanel workspaceId={workspaceId} widget={widget} xaiReady={xaiReady} />
            {!integration ? null : (
              <p className="text-xs text-graphite">El horario de citas y los documentos se eligen en «Horario de citas y documentos», aquí abajo.</p>
            )}
          </>
        )}
      </div>
    </details>
  )
}

// Horario de citas y documentos: comunes a la web y al teléfono.
export async function VoiceHoursCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { integration, files, config } = await voiceData(workspaceId)
  if (!integration || !isAdmin) return null
  return (
    <details data-integration-icon="schedule" data-integration-status="settings" name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Horario de citas y documentos</h3>
          <p className="text-sm text-graphite">Cuándo puede reservar citas el asistente (en la web y por teléfono) y qué documentos usa para responder.</p>
        </div>
      </summary>
      <div className="flex flex-col gap-3 px-5 py-5">
        <p className="text-xs text-graphite">Las citas quedan confirmadas en tu calendario, sin aprobación, solo dentro de este horario y si la hora está libre.</p>
        <VoiceSettingsForm workspaceId={workspaceId} config={config} files={files} />
      </div>
    </details>
  )
}

// Atención telefónica con un agente de voz de xAI.
export async function VoiceCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { integration, calendar, ws, config } = await voiceData(workspaceId)
  const url = `${supabaseUrl}/functions/v1/voice-mcp?w=${workspaceId}`
  const connected = Boolean(integration)

  return (
    <details data-help="voice-phone" data-integration-icon="voice" data-integration-status={integrationStatus(integration?.status, "setup")} name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Por teléfono (Grok Voice)</h3>
          <p className="text-sm text-graphite">
            Un agente de voz de xAI atiende las llamadas de tu negocio: consulta tu agenda y deja la cita reservada, toma recados y responde con
            tus documentos. Cada cita y cada recado llegan a la Bandeja y te avisan.
          </p>
        </div>
        <IntegrationStatusBadge status={integration?.status} invalidLabel="Desactivado" />
      </summary>
      <div className="flex flex-col gap-6 px-5 py-5">
        {!isAdmin ? (
          <p className="text-sm text-graphite">Solo un administrador puede configurar la atención telefónica.</p>
        ) : (
          <>
            {calendar?.status !== "active" ? <CalendarWarning /> : null}
            <section className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-ink">1. Acceso para el agente de voz</h4>
              <VoiceAccess workspaceId={workspaceId} url={url} connected={connected} />
            </section>
            {connected ? (
              <>
                <section className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-ink">2. Crea el agente en xAI</h4>
                  <ol className="list-decimal pl-5 text-sm text-graphite">
                    <li>Entra en console.x.ai → Voice Agents y crea un agente con la plantilla «Custom».</li>
                    <li>Pega estas instrucciones como guion del agente y elige una voz.</li>
                    <li>
                      En herramientas, añade un servidor MCP remoto y pega la URL con la clave incluida. No hace falta OAuth ni rellenar
                      credenciales. Si no la copiaste, crea una clave nueva.
                    </li>
                    <li>Asigna el número de teléfono que te da xAI (o el tuyo por SIP), pruébalo desde el navegador y llama para comprobarlo.</li>
                  </ol>
                  <VoicePlaybook text={playbook(ws?.name ?? "tu negocio", config)} />
                  <p className="text-xs text-graphite">
                    Coste en tu cuenta de xAI: unos 0,08 $ por minuto de conversación, más 0,01 $/min si usas el número de xAI.
                  </p>
                </section>
                <DisconnectVoiceForm workspaceId={workspaceId} />
              </>
            ) : null}
          </>
        )}
      </div>
    </details>
  )
}
