import { createClient } from "@/lib/supabase/server"
import { removeContact } from "../run-actions"
import Link from "next/link"
import { AddContactForm, ConnectWhatsAppForm, DisconnectWhatsAppForm, WebhookInfo } from "./whatsapp-client"
import { EmbeddedSignupButton } from "./whatsapp-embedded"
import { RetrySyncButton, WhatsAppSettingsForm } from "./whatsapp-settings"

const DEFAULT_CATEGORIES = ["Cliente", "Proveedor", "Obra o proyecto", "Administración", "Personal", "Publicidad", "Otros"]

export async function WhatsAppCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const [{ data: integration }, { data: contacts }] = await Promise.all([
    supabase.from("integrations").select("account_email, status, config").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle(),
    supabase.from("contacts").select("id, name, phone").eq("workspace_id", workspaceId).order("name"),
  ])
  const config = (integration?.config ?? {}) as {
    verified_name?: string | null
    mode?: string
    coexistence?: boolean
    categories?: string[]
    retention_days?: number | null
  }
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID
  const metaConfigId = process.env.NEXT_PUBLIC_META_CONFIG_ID

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h2 className="rotulo text-lg">WhatsApp</h2>
          <p className="text-sm text-graphite">
            Avisos a contactos autorizados y flujos que arrancan cuando alguien escribe. Con tu cuenta de WhatsApp Business (Meta).
          </p>
        </div>
        {integration?.status === "active" ? (
          <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">{config.coexistence ? "Conectado · coexistencia" : "Conectado"}</span>
        ) : integration ? (
          <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Desvinculado</span>
        ) : (
          <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
        )}
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            Número <span className="font-medium text-ink">{integration.account_email ?? "conectado"}</span>
            {config.verified_name ? ` (${config.verified_name})` : ""}. Todo envío necesita tu aprobación.
          </p>
        ) : null}

        {isAdmin ? (
          integration ? (
            <>
              {integration.status !== "active" ? (
                <p className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
                  El número se desvinculó de Delega desde WhatsApp o Meta. Desconéctalo aquí y vuelve a conectarlo.
                </p>
              ) : null}
              <p className="text-sm">
                <Link href={`/w/${workspaceId}/bandeja`} className="text-stroke underline underline-offset-4">
                  Abrir la bandeja clasificada
                </Link>
              </p>
              {config.mode === "manual" ? <WebhookInfo workspaceId={workspaceId} /> : null}
              {config.coexistence ? <RetrySyncButton workspaceId={workspaceId} /> : null}
              <details className="text-sm">
                <summary className="cursor-pointer text-ink">Ajustes de clasificación y conservación</summary>
                <div className="mt-3">
                  <WhatsAppSettingsForm
                    workspaceId={workspaceId}
                    categories={config.categories?.length ? config.categories : DEFAULT_CATEGORIES}
                    retentionDays={config.retention_days ?? null}
                  />
                </div>
              </details>
            </>
          ) : (
            <>
              {metaAppId && metaConfigId ? (
                <EmbeddedSignupButton workspaceId={workspaceId} appId={metaAppId} configId={metaConfigId} />
              ) : (
                <p className="text-sm text-graphite">
                  La conexión en un clic con WhatsApp Business estará disponible cuando Meta apruebe la app de Delega.
                </p>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-ink">Conexión manual con una app de Meta propia</summary>
                <div className="mt-3">
                  <ConnectWhatsAppForm workspaceId={workspaceId} />
                </div>
              </details>
            </>
          )
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar WhatsApp.</p>
        )}

        <div>
          <h3 className="text-sm font-semibold text-ink">Contactos autorizados</h3>
          <p className="mt-1 text-xs text-graphite">
            Los flujos solo pueden escribir a estas personas o responder a quien les haya escrito.
          </p>
          {contacts && contacts.length > 0 ? (
            <ul className="mt-2 divide-y divide-rule border border-rule">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <span className="text-ink">{c.name}</span> <span className="text-graphite">{c.phone}</span>
                  </span>
                  {isAdmin ? (
                    <form action={removeContact}>
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="contactId" value={c.id} />
                      <button type="submit" className="text-xs text-alert underline underline-offset-4">
                        Quitar
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-graphite">Aún no hay contactos.</p>
          )}
          {isAdmin ? <AddContactForm workspaceId={workspaceId} /> : null}
        </div>

        {isAdmin && integration ? <DisconnectWhatsAppForm workspaceId={workspaceId} /> : null}
      </div>
    </section>
  )
}
