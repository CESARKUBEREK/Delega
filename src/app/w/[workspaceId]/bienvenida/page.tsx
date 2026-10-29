import Link from "next/link"
import { Suspense } from "react"
import { AI_PROVIDERS } from "@/lib/plan"
import { SETUP_STEPS, setupStatus, type SetupStepId } from "@/lib/setup"
import { getWorkspace } from "@/lib/workspace"
import { AiCard } from "../integraciones/ai-card"
import { DriveCard } from "../integraciones/google-card"
import { ImapCard, TelegramCard, WhatsAppCard } from "../integraciones/inbox-cards"
import { CalendarCard } from "../integraciones/work-cards"
import { ForgetSetup, SetupStepBody } from "./setup-client"

export const metadata = { title: "Configura MarchaSolo" }

// Asistente de configuración: lleva paso a paso por las conexiones de un
// espacio nuevo. Usa las mismas tarjetas que Integraciones, así que lo que se
// conecta aquí queda conectado allí.
export default function SetupPage({ params, searchParams }: PageProps<"/w/[workspaceId]/bienvenida">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
      <Setup params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Setup({ params, searchParams }: Pick<PageProps<"/w/[workspaceId]/bienvenida">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const { isAdmin, workspace } = await getWorkspace(workspaceId, `/w/${workspaceId}/bienvenida`)
  const status = await setupStatus(workspaceId)
  const base = `/w/${workspaceId}`

  // Paso pedido; si no hay, el primero sin hacer.
  const requested = SETUP_STEPS.find((s) => s.id === sp.paso)
  const firstPending = SETUP_STEPS.find((s) => s.id !== "listo" && !status[s.id as Exclude<SetupStepId, "listo">])
  const step = requested ?? firstPending ?? SETUP_STEPS[SETUP_STEPS.length - 1]
  const index = SETUP_STEPS.indexOf(step)
  const prev = SETUP_STEPS[index - 1]
  const next = SETUP_STEPS[index + 1]
  const isDone = (id: SetupStepId) => (id === "listo" ? status.complete : status[id])
  const googleNotice = sp.google === "conectado" ? "connected" : typeof sp.google_error === "string" ? sp.google_error : null

  return (
    <div className="setup flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="app-eyebrow">CONFIGURA TU ESPACIO · {workspace.name.toUpperCase()}</p>
        <h1 className="rotulo text-2xl">Pon MarchaSolo en marcha</h1>
        <p className="text-graphite">
          Conecta tus propias cuentas, paso a paso. Solo la IA es imprescindible; lo demás puedes saltarlo y hacerlo cuando quieras desde{" "}
          <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
            Integraciones
          </Link>
          .
        </p>
        <div className="setup-progress" role="progressbar" aria-valuemin={0} aria-valuemax={status.total} aria-valuenow={status.done} aria-label="Pasos hechos">
          <span style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} />
        </div>
        <p className="text-sm font-medium text-graphite">
          {status.done} de {status.total} conexiones hechas
        </p>
      </header>

      <nav aria-label="Pasos" className="setup-steps">
        <ol>
          {SETUP_STEPS.map((s, i) => {
            const done = isDone(s.id)
            const current = s.id === step.id
            return (
              <li key={s.id}>
                <Link
                  href={`${base}/bienvenida?paso=${s.id}`}
                  aria-current={current ? "step" : undefined}
                  className={`setup-step-link ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
                >
                  <span className="setup-step-dot" aria-hidden="true">
                    {done ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="setup-step-label">
                    {s.short}
                    <span className="sr-only">{done ? " (hecho)" : s.required ? " (imprescindible)" : ""}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <section aria-labelledby="setup-title" className="setup-panel">
        <div className="setup-panel-head">
          <p className="text-sm font-semibold text-graphite">
            Paso {index + 1} de {SETUP_STEPS.length}
            {step.required ? " · Imprescindible" : step.id === "listo" ? "" : " · Opcional"}
          </p>
          <h2 id="setup-title" className="rotulo text-xl">
            {step.title}
            {step.id !== "listo" && isDone(step.id) ? <span className="setup-done-chip">Hecho</span> : null}
          </h2>
          <p className="max-w-prose text-graphite">{step.why}</p>
        </div>

        {!isAdmin && step.id !== "listo" ? (
          <p className="rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-graphite">
            En este espacio, las conexiones las gestiona un administrador. Para conectar tus propias cuentas, usa tu espacio personal.
          </p>
        ) : null}

        <SetupStepBody workspaceId={workspaceId} step={step.id}>
          {step.id === "ia" ? (
            <>
              <p className="text-sm text-graphite">
                Elige una. Si no sabes cuál: OpenAI (además transcribe el dictado por voz) o DeepSeek, la más económica.
              </p>
              <div className="integration-grid">
                {AI_PROVIDERS.map((p) => (
                  <AiCard key={p.id} workspaceId={workspaceId} isAdmin={isAdmin} provider={p.id} />
                ))}
              </div>
            </>
          ) : step.id === "correo" ? (
            <div className="integration-grid">
              <ImapCard workspaceId={workspaceId} isAdmin={isAdmin} />
            </div>
          ) : step.id === "drive" ? (
            <>
              <p className="text-sm text-graphite">
                Si Google te dice que la app no está verificada o bloquea el acceso, pide a quien te invitó que añada tu correo de Google como usuario de prueba.
              </p>
              <div className="integration-grid">
                <DriveCard workspaceId={workspaceId} isAdmin={isAdmin} notice={googleNotice} />
              </div>
            </>
          ) : step.id === "calendario" ? (
            <div className="integration-grid">
              <CalendarCard workspaceId={workspaceId} isAdmin={isAdmin} notice={sp.calendar === "conectado"} />
            </div>
          ) : step.id === "mensajeria" ? (
            <div className="integration-grid">
              <TelegramCard workspaceId={workspaceId} isAdmin={isAdmin} />
              <WhatsAppCard workspaceId={workspaceId} isAdmin={isAdmin} />
            </div>
          ) : (
            <Finish base={base} aiReady={status.ia} />
          )}
        </SetupStepBody>

        <div className="setup-nav">
          {prev ? (
            <Link href={`${base}/bienvenida?paso=${prev.id}`} className="setup-back">
              ← {prev.short}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`${base}/bienvenida?paso=${next.id}`} className={isDone(step.id) ? "setup-next" : "setup-skip"}>
              {isDone(step.id) ? `Siguiente: ${next.short}` : step.required ? `Saltar por ahora` : `Saltar: ${next.short}`} →
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function Finish({ base, aiReady }: { base: string; aiReady: boolean }) {
  const examples = ["¿Qué reuniones tengo mañana?", "Resume los correos importantes de hoy", "Cada lunes a las 9, avísame de las facturas pendientes"]
  return (
    <div className="flex flex-col gap-4">
      <ForgetSetup />
      {aiReady ? (
        <>
          <p className="text-ink">Ya puedes pedirle cosas. Prueba con una de estas:</p>
          <ul className="flex flex-col gap-2">
            {examples.map((e) => (
              <li key={e}>
                <Link href={`${base}/asistente?q=${encodeURIComponent(e)}`} className="setup-example">
                  {e}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/asistente`} className="inline-flex h-11 items-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink">
              Abrir el chat
            </Link>
            <Link href={base} className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink">
              Ir a Hoy
            </Link>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-graphite">
          Falta conectar la IA: sin ella, MarchaSolo no puede trabajar.{" "}
          <Link href={`${base}/bienvenida?paso=ia`} className="font-semibold text-link underline underline-offset-4">
            Volver al paso 1
          </Link>
          .
        </p>
      )}
    </div>
  )
}
