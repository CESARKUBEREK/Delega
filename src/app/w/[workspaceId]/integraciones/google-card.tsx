import { fileKindLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { connectGoogle, removeSheet } from "../run-actions"
import { DisconnectGoogleForm, PickSheetsButton } from "./google-client"

const NOTICES: Record<string, string> = {
  connected: "Google Drive conectado. Ahora elige los archivos y carpetas que Delega puede usar.",
  not_configured: "La conexión con Google aún no está configurada en el servidor.",
  forbidden: "Solo un administrador puede conectar Google.",
}

export async function GoogleSheetsCard({
  workspaceId,
  isAdmin,
  notice,
}: {
  workspaceId: string
  isAdmin: boolean
  notice: string | null
}) {
  const supabase = await createClient()
  const [{ data: integration }, { data: files }] = await Promise.all([
    supabase.from("integrations").select("account_email, status").eq("workspace_id", workspaceId).eq("provider", "google").maybeSingle(),
    supabase.from("integration_files").select("id, name, url, mime_type").eq("workspace_id", workspaceId).order("name"),
  ])
  const pickerReady = Boolean(process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_APP_ID)

  return (
    <section className="border border-ink bg-sheet">
      <div className="flex items-start justify-between gap-4 border-b border-ink px-5 py-4">
        <div>
          <h2 className="rotulo text-lg">Google Drive, Sheets y Docs</h2>
          <p className="text-sm text-graphite">
            Planillas, documentos, PDF, Word, Excel y carpetas que tus automatizaciones pueden leer y, con tu aprobación,
            modificar. También pueden crear documentos y guardar archivos en las carpetas elegidas.
          </p>
        </div>
        {integration?.status === "active" ? (
          <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
        ) : integration ? (
          <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Acceso retirado</span>
        ) : (
          <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {notice ? (
          <p
            role="status"
            className={`border-l-2 px-3 py-2 text-sm ${notice === "connected" ? "border-ok bg-ok-bg text-ok" : "border-alert bg-alert-bg text-alert"}`}
          >
            {NOTICES[notice] ?? "No se pudo conectar con Google. Inténtalo de nuevo."}
          </p>
        ) : null}

        {integration ? (
          <p className="text-sm text-graphite">
            Cuenta <span className="font-medium text-ink">{integration.account_email ?? "de Google"}</span>.{" "}
            {integration.status === "active"
              ? "Delega solo puede abrir los archivos y carpetas que elijas aquí y lo que cree. En una carpeta ve los archivos que Google le permita; si falta alguno, elígelo también."
              : "Google retiró el acceso: vuelve a conectar la cuenta."}
          </p>
        ) : (
          <p className="text-sm text-graphite">
            Conecta una cuenta de Google y elige qué archivos y carpetas puede usar Delega. No tendrá acceso al resto de tu Drive.
          </p>
        )}

        {files && files.length > 0 ? (
          <ul className="divide-y divide-rule border border-rule">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate text-ink underline underline-offset-4">
                    {f.name}
                  </a>
                ) : (
                  <span className="truncate text-ink">{f.name}</span>
                )}
                <span className="ml-auto shrink-0 text-xs text-graphite">
                  {fileKindLabel(f.mime_type)}
                </span>
                {isAdmin ? (
                  <form action={removeSheet}>
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="fileId" value={f.id} />
                    <button type="submit" className="shrink-0 text-xs text-alert underline underline-offset-4">
                      Quitar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : integration ? (
          <p className="text-sm text-graphite">Aún no has elegido ningún archivo.</p>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-col gap-4">
            {integration?.status === "active" ? (
              pickerReady ? (
                <PickSheetsButton
                  workspaceId={workspaceId}
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY!}
                  appId={process.env.NEXT_PUBLIC_GOOGLE_APP_ID!}
                />
              ) : (
                <p className="text-sm text-graphite">El selector de archivos está pendiente de configurar.</p>
              )
            ) : (
              <form action={connectGoogle}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <button type="submit" className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90">
                  {integration ? "Volver a conectar Google Drive" : "Conectar Google Drive"}
                </button>
              </form>
            )}
            {integration ? <DisconnectGoogleForm workspaceId={workspaceId} /> : null}
          </div>
        ) : (
          <p className="text-sm text-graphite">Solo un administrador del espacio puede conectar Google Drive o elegir archivos.</p>
        )}
      </div>
    </section>
  )
}
