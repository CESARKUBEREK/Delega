// Utilidades de texto del correo: HTML a texto y recorte de la cita del mensaje anterior.

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
}

// Quita las citas del mensaje anterior para no repetir el hilo entero.
export function stripQuoted(text: string): string {
  const lines = text.split("\n")
  const cut = lines.findIndex((l) => /^(El .+ escribió:|On .+ wrote:|-----Original Message-----|De: .+)$/.test(l.trim()))
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith(">"))
  return kept.join("\n").trim()
}
