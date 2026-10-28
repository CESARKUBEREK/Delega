// Marca de MarchaSolo: un robot de cuerda (azul) con su llave (coral) y el
// nombre en Montserrat. Paleta del logo: azul #2457D6, marino #17233E,
// coral #E85A45, fondo #F7F8FC y blanco.

export function LogoMark({ size = 32, className }: { size?: number; id?: string; className?: string }) {
  // Proporción del dibujo: 372 × 288.
  const width = Math.round((size * 376) / 288)
  return (
    <svg width={width} height={size} viewBox="56 56 376 288" aria-hidden="true" className={className}>
      <rect x="189" y="62" width="34" height="22" rx="8" fill="#2457D6" />
      <rect x="198" y="80" width="16" height="30" fill="#2457D6" />
      <rect x="63" y="186" width="34" height="65" rx="10" fill="#2457D6" />
      <rect x="315" y="186" width="34" height="65" rx="10" fill="#2457D6" />
      <rect x="84" y="103" width="244" height="232" rx="56" fill="#2457D6" />
      <circle cx="152" cy="221" r="20" fill="none" stroke="#FFFFFF" strokeWidth="16" />
      <circle cx="260" cy="221" r="20" fill="none" stroke="#FFFFFF" strokeWidth="16" />
      <rect x="340" y="209" width="58" height="19" fill="#E85A45" />
      <circle cx="398.5" cy="197" r="16" fill="none" stroke="#E85A45" strokeWidth="11" />
      <circle cx="398.5" cy="241" r="16" fill="none" stroke="#E85A45" strokeWidth="11" />
    </svg>
  )
}

// Logotipo completo: el robot y «Marcha Solo» en dos líneas, como el logo.
// size es la altura del robot; el nombre toma el color del texto (currentColor).
export function Logo({ size = 28, tagline = false }: { size?: number; tagline?: boolean; id?: string }) {
  return (
    <span className="brand-logo" style={{ gap: Math.round(size * 0.28) }} data-tagline={tagline ? "included" : undefined}>
      <LogoMark size={size} />
      <span className="brand-wordmark" aria-hidden="true" style={{ fontSize: Math.round(size * 0.47) }}>
        <span>Marcha</span>
        <span>Solo</span>
      </span>
      <span className="sr-only">MarchaSolo</span>
    </span>
  )
}
