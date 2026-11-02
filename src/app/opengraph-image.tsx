import { ImageResponse } from "next/og"

export const alt = "MarchaSolo: las tareas avanzan, tú decides."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Imagen para compartir: marino, el logotipo y el mensaje principal.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b1f3b", color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 264 264">
            <rect width="264" height="264" rx="58" fill="#00C2A8" />
            <g fill="none" stroke="#0B1F3B" strokeLinecap="round" strokeLinejoin="round">
              <path d="M116 76 L180 132 L116 188" strokeWidth="31" />
              <path d="M50 99 H80 M43 132 H80 M50 165 H80" strokeWidth="22" />
            </g>
          </svg>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
            Marcha<span style={{ color: "#00c2a8" }}>Solo</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Las tareas avanzan. Tú decides.</div>
          <div style={{ fontSize: 34, color: "#c6d3e2" }}>Tu negocio, en automático.</div>
        </div>
      </div>
    ),
    size,
  )
}
