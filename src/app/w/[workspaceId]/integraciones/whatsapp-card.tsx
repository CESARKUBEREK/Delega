import { createClient } from "@/lib/supabase/server"
import { removeContact } from "../run-actions"
import { formatDateTime } from "../format"
import { AddContactForm, ConnectWhatsAppForm, DisconnectWhatsAppForm, WebhookInfo } from "./whatsapp-client"

export async function WhatsAppCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const [{ data: integration }, { data: contacts }, { data: messages }] = await Promise.all([
    supabase.from("integrations").select("account_email, status, config").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle(),
    supabase.from("contacts").select("id, name, phone").eq("workspace_id", workspaceId).order("name"),
    isAdmin
      ? supabase
          .from("whatsapp_messages")
          .select("id, direction, phone, contact_name, body, status, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as { id: number; direction: string; phone: string; contact_name: string | null; body: string; status: string | null; created_at: string }[] }),
  ])
  const config = (integration?.config ?? {}) as { verified_name?: string | null }

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h2 className="rotulo text-lg">WhatsApp</h2>
          <p className="text-sm text-graphite">
            Avisos a contactos autorizados y flujos que arrancan cuando alguien escribe. Con tu cuenta de WhatsApp Business (Meta).
          </p>
        </div>
        {integration ? (
          <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
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
            <WebhookInfo workspaceId={workspaceId} />
          ) : (
            <ConnectWhatsAppForm workspaceId={workspaceId} />
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

        {isAdmin && messages && messages.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-ink">Últimos mensajes</h3>
            <ul className="mt-2 divide-y divide-rule border border-rule">
              {messages.map((m) => (
                <li key={m.id} className="px-3 py-2 text-sm">
                  <p className="flex justify-between gap-3 text-xs text-graphite">
                    <span>
                      {m.direction === "in" ? "Recibido de" : "Enviado a"} {m.contact_name ?? `+${m.phone.replace(/^\+/, "")}`}
                      {m.status && m.direction === "out" ? ` · ${m.status}` : ""}
                    </span>
                    <span>{formatDateTime(m.created_at)}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-ink">{m.body || "(sin texto)"}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isAdmin && integration ? <DisconnectWhatsAppForm workspaceId={workspaceId} /> : null}
      </div>
    </section>
  )
}
