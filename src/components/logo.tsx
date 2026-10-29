// Marca de MarchaSolo: cuadrado turquesa con la flecha en marcha (marino) y
// el nombre en Outfit, «Marcha» en el color del texto y «Solo» en turquesa.
// Paleta del logo: marino #0B1F3B, turquesa #00C2A8, gris claro #F3F6FA y blanco.

export function LogoMark({ size = 32, className }: { size?: number; id?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 264 264" aria-hidden="true" className={className}>
      <rect width="264" height="264" rx="58" fill="#00C2A8" />
      <g fill="none" stroke="#0B1F3B" strokeLinecap="round" strokeLinejoin="round">
        <path d="M116 76 L180 132 L116 188" strokeWidth="31" />
        <path d="M50 99 H80 M43 132 H80 M50 165 H80" strokeWidth="22" />
      </g>
    </svg>
  )
}

// Logotipo completo: icono y «MarchaSolo» en una línea, como el logo.
// size es la altura del icono. «Marcha» toma el color del texto (blanco sobre
// marino, marino sobre claro); «Solo» va siempre en turquesa.
// tagline añade «Tu negocio, en automático.» debajo.
export function Logo({ size = 28, tagline = false }: { size?: number; tagline?: boolean; id?: string }) {
  return (
    <span className="brand-logo" style={{ gap: Math.round(size * 0.3) }}>
      <LogoMark size={size} />
      <span className="brand-text" aria-hidden="true">
        <span className="brand-wordmark" style={{ fontSize: Math.round(size * 0.72) }}>
          Marcha<span className="brand-wordmark-accent">Solo</span>
        </span>
        {tagline ? (
          <span className="brand-tagline" style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}>
            Tu negocio, en automático.
          </span>
        ) : null}
      </span>
      <span className="sr-only">MarchaSolo</span>
    </span>
  )
}
