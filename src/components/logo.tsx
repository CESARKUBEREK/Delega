// Marca de Orkesta: anillo fluido (verde → turquesa → azul) y logotipo.
// Paleta: azul marino #0B1F3B, turquesa #00C2A8, verde #34D399, gris #F3F6FA, blanco.

export function LogoMark({ size = 32, id = "orkesta", className }: { size?: number; id?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-a`} x1="8" y1="54" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B5E9E" />
          <stop offset="0.45" stopColor="#0A9FB0" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="10" y1="10" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#00C2A8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id}-a)`}
        fillRule="evenodd"
        d="M22 8.5C31 3.5 48 4.5 55 13.5 61.5 22 58 35.5 49 46.5 41.5 55.5 26 61 15.5 55.5 6 50.5 5 37 9 26 11 19.5 15.5 12 22 8.5ZM41.6 18.4C37.4 14.2 29.2 17 24.2 23.7 19.2 30.4 18.5 39.4 22.7 43.6 26.9 47.8 35.1 45 40.1 38.3 45.1 31.6 45.8 22.6 41.6 18.4Z"
      />
      <path
        fill={`url(#${id}-b)`}
        opacity="0.85"
        d="M22 8.5C15.5 12 11 19.5 9 26 7.6 30 7 34.3 7.4 38.2 11.4 30.2 17.6 22.6 24.2 18.8 29.6 15.7 36.4 14.6 41.6 18.4 39.6 12.6 31 6.8 22 8.5Z"
      />
    </svg>
  )
}

// Logotipo completo. "size" es la altura de la marca en píxeles.
export function Logo({ size = 28, tagline = false, id }: { size?: number; tagline?: boolean; id?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} id={id} />
      <span className="flex flex-col">
        <span className="logotipo text-ink" style={{ fontSize: Math.round(size * 0.72) }}>
          ORKEST<span className="text-turquesa">A</span>
        </span>
        {tagline ? <span className="text-xs text-graphite">Tu negocio, en automático.</span> : null}
      </span>
    </span>
  )
}
