import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "../format"
import { removeContact } from "../run-actions"
import { AddContactForm, DisconnectInboxForm, ImapForm, TelegramForm } from "./inbox-client"

function Badge({ status, invalidLabel }: { status: string | null | undefined; invalidLabel: string }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status) return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">{invalidLabel}</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}

// Contactos a los que las automatizaciones pueden escribir.
function Contacts({ workspaceId, isAdmin, contacts }: { workspaceId: string; isAdmin: boolean; contacts: { id: string; name: string; email: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">Contactos autorizados</h4>
      <p className="mt-1 text-xs text-graphite">
        Las automatizaciones solo pueden enviar correos nuevos a estas personas. Desde la bandeja puedes responder a cualquiera.
      </p>
      {contacts && contacts.length > 0 ? (
        <ul className="mt-2 divide-y divide-rule border border-rule">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-ink">{c.name}</span> <span className="text-graphite">{c.email}</span>
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
  )
}

export async function TelegramCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_email, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "telegram")
    .maybeSingle()
  const username = integration?.account_email?.replace(/^@/, "")

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h3 className="rotulo text-lg">Telegram</h3>
          <p className="text-sm text-graphite">
            Un bot propio: lo que le escriban llega a la bandeja y puede lanzar automatizaciones. Las respuestas esperan tu aprobación.
          </p>
        </div>
        <Badge status={integration?.status} invalidLabel="Desconectado" />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            Bot{" "}
            {username ? (
              <a href={`https://t.me/${encodeURIComponent(username)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">
                @{username}
              </a>
            ) : (
              <span className="font-medium text-ink">conectado</span>
            )}
            . Comparte el enlace con tus clientes o escríbele tú para probar.
          </p>
        ) : null}

        {isAdmin ? (
          <>
            <TelegramForm workspaceId={workspaceId} replacing={Boolean(integration)} />
            {!integration ? (
              <details className="text-sm text-graphite">
                <summary className="cursor-pointer text-ink">Cómo creo el bot</summary>
                <ol className="mt-2 list-decimal pl-5">
                  <li>En Telegram, abre una conversación con @BotFather (tiene la marca de verificación azul).</li>
                  <li>Envía /newbot, elige un nombre visible y un usuario que termine en «bot».</li>
                  <li>BotFather te responde con un token (números, dos puntos y letras). Cópialo y pégalo aquí.</li>
                </ol>
                <p className="mt-2">
                  Si añades el bot a un grupo, por privacidad solo verá los mensajes que lo mencionen, salvo que lo cambies en
                  BotFather con /setprivacy.
                </p>
              </details>
            ) : null}
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="telegram" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar el bot.</p>
        )}
      </div>
    </section>
  )
}

export async function ImapCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const [{ data: integration }, { data: contacts }] = await Promise.all([
    supabase.from("integrations").select("account_email, status, config").eq("workspace_id", workspaceId).eq("provider", "imap").maybeSingle(),
    supabase.from("contacts").select("id, name, email").eq("workspace_id", workspaceId).order("name"),
  ])
  const config = (integration?.config ?? {}) as {
    email?: string
    display_name?: string | null
    imap_host?: string
    smtp_host?: string
    sent_folder?: string | null
    last_sync_at?: string
  }

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h3 className="rotulo text-lg">Correo IMAP/SMTP</h3>
          <p className="text-sm text-graphite">
            El correo de tu dominio, de tu hosting (OVH, IONOS, Hostinger…) o de Gmail. Llega a la bandeja y puedes responder desde Orkesta, siempre
            revisando antes.
          </p>
        </div>
        <Badge status={integration?.status} invalidLabel="Contraseña rechazada" />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {integration ? (
          <p className="text-sm text-graphite">
            Buzón <span className="font-medium text-ink">{integration.account_email}</span> ({config.imap_host}).{" "}
            {integration.status === "active"
              ? config.last_sync_at
                ? `Última lectura: ${formatDateTime(config.last_sync_at)}.`
                : "Aún no se ha leído el correo."
              : "El servidor rechazó la contraseña: vuelve a escribirla abajo."}{" "}
            {config.sent_folder ? `Las respuestas se guardan en «${config.sent_folder}».` : ""}{" "}
            <Link href={`/w/${workspaceId}/bandeja`} className="text-link underline underline-offset-4">
              Abrir la bandeja
            </Link>
          </p>
        ) : null}

        {isAdmin ? (
          <>
            <ImapForm
              workspaceId={workspaceId}
              current={
                integration
                  ? {
                      email: integration.account_email ?? config.email ?? "",
                      imapHost: config.imap_host ?? "",
                      smtpHost: config.smtp_host ?? "",
                      displayName: config.display_name ?? "",
                    }
                  : null
              }
            />
            <details className="text-sm text-graphite">
              <summary className="cursor-pointer text-ink">Qué hace Orkesta con tu correo</summary>
              <ul className="mt-2 list-disc pl-5">
                <li>Lee la bandeja de entrada (los últimos 30 días la primera vez) y la ordena. No borra, no mueve ni marca nada como leído.</li>
                <li>Envía solo lo que apruebes, por SMTP con conexión cifrada (puerto 465), y guarda una copia en tu carpeta de enviados.</li>
                <li>Si tu proveedor solo admite el puerto 587, Orkesta no puede enviar por él: la comprobación te lo dirá.</li>
                <li>Outlook y Microsoft 365 no admiten este método: tendrán su propia conexión.</li>
              </ul>
            </details>
          </>
        ) : null}

        {integration ? <Contacts workspaceId={workspaceId} isAdmin={isAdmin} contacts={contacts ?? []} /> : null}

        {isAdmin ? (
          <>
            {integration ? <DisconnectInboxForm workspaceId={workspaceId} kind="imap" /> : null}
          </>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede conectar el correo.</p>
        )}
      </div>
    </section>
  )
}
