import Link from "next/link"
import { TrialMeter } from "@/components/trial-meter"
import type { TrialStatus } from "@/lib/trial"

// Hoy: créditos de prueba del espacio (solo sin IA propia y con el onboarding
// hecho; antes, el aviso lleva al onboarding).
export function TrialBanner({ base, trial }: { base: string; trial: TrialStatus }) {
  if (trial.exhausted) {
    return (
      <div className="rounded-2xl border border-alert bg-alert-bg px-5 py-4 text-sm text-alert" role="status">
        <p className="font-semibold">Se han acabado los créditos de prueba</p>
        <p className="mt-1">
          Conecta tu propia IA (OpenAI, Anthropic, DeepSeek o Grok) para seguir usando el asistente.{" "}
          <Link href={`${base}/integraciones#llms`} className="font-semibold underline underline-offset-4">
            Conectar mi IA →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-rule bg-sheet px-5 py-4 text-sm text-graphite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">Créditos de prueba</p>
        <p className="text-xs font-semibold text-ink">Te queda el {trial.pctLeft} %</p>
      </div>
      <p className="mt-1">
        Con ellos puedes preparar planes en el chat. Para ejecutarlos, usar la bandeja y las automatizaciones, conecta tu propia IA (OpenAI,
        Anthropic, DeepSeek o Grok).
      </p>
      <TrialMeter pctLeft={trial.pctLeft} />
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link href={`${base}/asistente`} className="font-semibold text-link underline underline-offset-4">
          Abrir el chat
        </Link>
        <Link href={`${base}/integraciones#llms`} className="font-semibold text-link underline underline-offset-4">
          Conectar mi propia IA →
        </Link>
      </p>
    </div>
  )
}
