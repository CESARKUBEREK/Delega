import { fileKindLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { connectGoogle, removeSheet } from "../run-actions"
import { DisconnectGoogleForm, PickSheetsButton } from "./google-client"

const NOTICES: Record<string, string> = {
  connected: "Google Drive conectado. Ahora elige los archivos y carpetas que Marcha Solo puede usar.",
  not_configured: "La conexión con Google aún no está configurada en el servidor.",
  forbidden: "Solo un administrador puede conectar Google.",
}

export const SHEET_MIMES = ["application/vnd.google-apps.spreadsheet"]
export const EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
]
export const DOC_MIMES = ["application/vnd.google-apps.document"]
const LISTED_ELSEWHERE = [...SHEET_MIMES, ...EXCEL_MIMES, ...DOC_MIMES]

type FileRow = { id: string; name: string; url: string | null; mime_type: string | null }

function Badge({ status }: { status: string | null | undefined }) {
  if (status === "active") return <span className="shrink-0 border border-ok px-2 py-0.5 text-xs text-ok">Conectado</span>
  if (status) return <span className="shrink-0 border border-alert px-2 py-0.5 text-xs text-alert">Acceso retirado</span>
  return <span className="shrink-0 border border-rule px-2 py-0.5 text-xs text-graphite">Sin conectar</span>
}

function FileList({ files, workspaceId, isAdmin }: { files: FileRow[]; workspaceId: string; isAdmin: boolean }) {
  return (
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
          <span className="ml-auto shrink-0 text-xs text-graphite">{fileKindLabel(f.mime_type)}</span>
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
  )
}

function Picker({ workspaceId, label }: { workspaceId: string; label: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID
  if (!key || !appId) return <p className="text-sm text-graphite">El selector de archivos está pendiente de configurar.</p>
  return <PickSheetsButton workspaceId={workspaceId} apiKey={key} appId={appId} label={label} />
}

async function load(workspaceId: string) {
  const supabase = await createClient()
  const [{ data: integration }, { data: files }] = await Promise.all([
    supabase.from("integrations").select("account_email, status").eq("workspace_id", workspaceId).eq("provider", "google").maybeSingle(),
    supabase.from("integration_files").select("id, name, url, mime_type").eq("workspace_id", workspaceId).order("name"),
  ])
  return { integration, files: (files ?? []) as FileRow[] }
}

// Conexión con Google Drive: carpetas y archivos sueltos (PDF, Word, presentaciones…).
export async function DriveCard({ workspaceId, isAdmin, notice }: { workspaceId: string; isAdmin: boolean; notice: string | null }) {
  const { integration, files } = await load(workspaceId)
  const own = files.filter((f) => !LISTED_ELSEWHERE.includes(f.mime_type ?? ""))

  return (
    <details name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Google Drive</h3>
          <p className="text-sm text-graphite">
            La conexión que usan Sheets, Excel y Docs. Aquí eliges carpetas y archivos sueltos (PDF, Word, presentaciones): las
            automatizaciones los leen y, con tu aprobación, guardan archivos nuevos en esas carpetas.
          </p>
        </div>
        <Badge status={integration?.status} />
      </summary>

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
              ? "Marcha Solo solo abre lo que elijas y lo que cree. En una carpeta ve los archivos que Google le permite; si falta alguno, elígelo también."
              : "Google retiró el acceso: vuelve a conectar la cuenta."}
          </p>
        ) : (
          <p className="text-sm text-graphite">
            Conecta una cuenta de Google y elige qué archivos y carpetas puede usar Marcha Solo. No tendrá acceso al resto de tu Drive.
          </p>
        )}

        {own.length > 0 ? (
          <FileList files={own} workspaceId={workspaceId} isAdmin={isAdmin} />
        ) : integration ? (
          <p className="text-sm text-graphite">Aún no has elegido carpetas ni archivos sueltos.</p>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-col gap-4">
            {integration?.status === "active" ? (
              <Picker workspaceId={workspaceId} label="Elegir archivos o carpetas" />
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
    </details>
  )
}

// Archivos de un tipo (planillas, Excel, documentos) elegidos con el selector de Drive.
export async function FilesCard({
  workspaceId,
  isAdmin,
  title,
  description,
  mimes,
  pickLabel,
  capability,
}: {
  workspaceId: string
  isAdmin: boolean
  title: string
  description: string
  mimes: string[]
  pickLabel: string
  capability: string
}) {
  const { integration, files } = await load(workspaceId)
  const mine = files.filter((f) => mimes.includes(f.mime_type ?? ""))
  const active = integration?.status === "active"

  return (
    <details name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">{title}</h3>
          <p className="text-sm text-graphite">{description}</p>
        </div>
        <span className={`shrink-0 border px-2 py-0.5 text-xs ${active ? "border-ok text-ok" : "border-rule text-graphite"}`}>
          {active ? `${mine.length} elegido${mine.length === 1 ? "" : "s"}` : "Sin conectar"}
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-5 py-5">
        <p className="text-xs text-graphite">{capability}</p>
        {mine.length > 0 ? (
          <FileList files={mine} workspaceId={workspaceId} isAdmin={isAdmin} />
        ) : active ? (
          <p className="text-sm text-graphite">Aún no has elegido ninguno.</p>
        ) : null}
        {active ? (
          isAdmin ? <Picker workspaceId={workspaceId} label={pickLabel} /> : null
        ) : (
          <p className="text-sm text-graphite">
            Usa la conexión de Google Drive.{" "}
            <a href="#drives" className="text-link underline underline-offset-4">
              Conéctala en Drives
            </a>
            .
          </p>
        )}
      </div>
    </details>
  )
}
