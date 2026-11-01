// Barra de lo que queda de los créditos de prueba (porcentaje 0–100).
export function TrialMeter({ pctLeft }: { pctLeft: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(pctLeft)))
  return (
    <span
      className="mt-2 block h-1.5 overflow-hidden rounded-full bg-rule"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="Créditos de prueba que quedan"
    >
      <span className="block h-full rounded-full bg-stroke" style={{ width: `${pct}%` }} />
    </span>
  )
}
