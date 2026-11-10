// Páginas vivas (fase 10): la parte pura, compartida con la app
// (src/lib/pages.ts). Sin dependencias ni imports: la importan Deno y Next.

export const MAX_PAGE_BYTES = 51_200
export const MAX_TITLE_CHARS = 120
export const MAX_SECTION_CHARS = 80

// «Informe Corrientes 1234» → «informe-corrientes-1234».
export function pageSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

const SECTION_RE = /^##\s+(.+?)\s*#*\s*$/

function sectionKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ")
}

// Nombres de las secciones «## …», en orden (fuera de bloques de código).
export function pageSections(md: string): string[] {
  const out: string[] = []
  let fence = false
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence
    if (fence) continue
    const m = SECTION_RE.exec(line)
    if (m) out.push(m[1].trim())
  }
  return out
}

// Quita del contenido nuevo una cabecera «## Sección» repetida al principio.
function stripOwnHeading(section: string, content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  while (lines.length && !lines[0].trim()) lines.shift()
  const m = lines.length ? SECTION_RE.exec(lines[0]) : null
  if (m && sectionKey(m[1]) === sectionKey(section)) lines.shift()
  return lines.join("\n").trim()
}

// Reemplaza el contenido de la sección «## section» (hasta la siguiente «## »).
// Sin sección, reemplaza la página entera. Si la sección no existe, la añade al
// final. Devuelve el Markdown nuevo.
export function replaceSection(md: string, section: string, content: string): string {
  const clean = content.replace(/\r\n/g, "\n")
  if (!section.trim()) return clean.trim() + "\n"
  const name = section.trim().slice(0, MAX_SECTION_CHARS)
  const body = stripOwnHeading(name, clean)
  const block = [`## ${name}`, ...(body ? ["", body] : [])]
  const lines = md.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n")
  if (lines.length === 1 && lines[0] === "") lines.length = 0

  let start = -1
  let end = lines.length
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fence = !fence
    if (fence) continue
    const m = SECTION_RE.exec(lines[i])
    if (!m) continue
    if (start === -1 && sectionKey(m[1]) === sectionKey(name)) start = i
    else if (start !== -1) {
      end = i
      break
    }
  }
  if (start === -1) return [...lines, ...(lines.length ? [""] : []), ...block].join("\n") + "\n"
  const after = lines.slice(end)
  return [...lines.slice(0, start), ...block, ...(after.length ? ["", ...after] : [])].join("\n") + "\n"
}

// ---------------------------------------------------------------------------
// Markdown → bloques (para pintarlo en React sin HTML: nada se ejecuta).
// Admite: # ## ###, párrafos, listas (-, *, 1.), citas (>), separadores (---),
// tablas sencillas (| a | b |), código entre ```, **negrita**, *cursiva*,
// `código` y enlaces [texto](https://…). Todo lo demás es texto.
// ---------------------------------------------------------------------------
export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: Inline[] }
  | { t: "em"; v: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; v: Inline[] }

export type Block =
  | { t: "heading"; level: 1 | 2 | 3; v: Inline[] }
  | { t: "paragraph"; v: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "quote"; v: Inline[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "code"; v: string }
  | { t: "rule" }

export function safeHref(href: string): string | null {
  const h = href.trim()
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h
  return null
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let buf = ""
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf })
    buf = ""
  }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    let m: RegExpExecArray | null
    if ((m = /^`([^`]+)`/.exec(rest))) {
      flush()
      out.push({ t: "code", v: m[1] })
      i += m[0].length
    } else if ((m = /^\*\*(.+?)\*\*/.exec(rest)) || (m = /^__(.+?)__/.exec(rest))) {
      flush()
      out.push({ t: "strong", v: parseInline(m[1]) })
      i += m[0].length
    } else if ((m = /^\*([^*\s][^*]*?)\*/.exec(rest)) || (m = /^_([^_\s][^_]*?)_(?![A-Za-z0-9])/.exec(rest))) {
      flush()
      out.push({ t: "em", v: parseInline(m[1]) })
      i += m[0].length
    } else if ((m = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/.exec(rest))) {
      const href = safeHref(m[2])
      flush()
      if (href) out.push({ t: "link", href, v: parseInline(m[1]) })
      else out.push(...parseInline(m[1]))
      i += m[0].length
    } else {
      buf += text[i]
      i++
    }
  }
  flush()
  return out
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ t: "paragraph", v: parseInline(para.join(" ")) })
    para = []
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    let m: RegExpExecArray | null
    if (/^```/.test(trimmed)) {
      flushPara()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++])
      i++
      blocks.push({ t: "code", v: code.join("\n") })
      continue
    }
    if (!trimmed) {
      flushPara()
      i++
      continue
    }
    if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed))) {
      flushPara()
      blocks.push({ t: "heading", level: Math.min(m[1].length, 3) as 1 | 2 | 3, v: parseInline(m[2]) })
      i++
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara()
      blocks.push({ t: "rule" })
      i++
      continue
    }
    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(lines[i + 1].trim())) {
      flushPara()
      const head = tableCells(trimmed).map(parseInline)
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(tableCells(lines[i++]).map(parseInline))
      blocks.push({ t: "table", head, rows })
      continue
    }
    if (/^>\s?/.test(trimmed)) {
      flushPara()
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) q.push(lines[i++].trim().replace(/^>\s?/, ""))
      blocks.push({ t: "quote", v: parseInline(q.join(" ")) })
      continue
    }
    const bullet = /^([-*+])\s+/
    const numbered = /^\d+[.)]\s+/
    if (bullet.test(trimmed) || numbered.test(trimmed)) {
      flushPara()
      const ordered = numbered.test(trimmed)
      const re = ordered ? numbered : bullet
      const items: Inline[][] = []
      while (i < lines.length && re.test(lines[i].trim())) items.push(parseInline(lines[i++].trim().replace(re, "")))
      blocks.push({ t: "list", ordered, items })
      continue
    }
    para.push(trimmed)
    i++
  }
  flushPara()
  return blocks
}

// ---------------------------------------------------------------------------
// «Ver cambios»: diff por líneas (LCS). Para páginas de hasta 50 KB.
// ---------------------------------------------------------------------------
export type DiffLine = { op: "same" | "add" | "del"; text: string }

export function diffLines(before: string, after: string, maxLines = 2000): DiffLine[] {
  const a = before.replace(/\r\n/g, "\n").split("\n").slice(0, maxLines)
  const b = after.replace(/\r\n/g, "\n").split("\n").slice(0, maxLines)
  const n = a.length
  const m = b.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "del", text: a[i++] })
    else out.push({ op: "add", text: b[j++] })
  }
  while (i < n) out.push({ op: "del", text: a[i++] })
  while (j < m) out.push({ op: "add", text: b[j++] })
  return out
}

// Resumen breve de un diff para el registro de la ejecución.
export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.op === "add").length,
    removed: lines.filter((l) => l.op === "del").length,
  }
}
