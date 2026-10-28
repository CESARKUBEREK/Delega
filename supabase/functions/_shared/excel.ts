// Archivos Excel (.xlsx) guardados en Google Drive: leer hojas y rangos, añadir
// filas y actualizar celdas. Se descarga el archivo, se modifica con ExcelJS y
// se sube como nueva versión del mismo archivo (Drive conserva la anterior).
//
// - Los textos se escriben tal cual: nada se interpreta como fórmula.
// - ExcelJS no conserva gráficos ni tablas dinámicas: si el libro tiene
//   alguno, no se escribe en él (solo lectura) para no estropearlo.
// - Límite de tamaño para no pasar del tiempo de CPU de la función.
import ExcelJS from "npm:exceljs@4.4.0"
import JSZip from "npm:jszip@3.10.1"
import { Buffer } from "node:buffer"
import { GoogleError } from "./google.ts"

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const MAX_BYTES = 5 * 1024 * 1024
const DRIVE = "https://www.googleapis.com/drive/v3/files"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"

export type Cell = string | number | boolean | null

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(45_000) })
  } catch {
    throw new GoogleError("unavailable", "Google Drive no respondió a tiempo.")
  }
  if (!res.ok) {
    await res.body?.cancel()
    if (res.status === 404) throw new GoogleError("not_found", "No se encontró el archivo Excel en Drive.")
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", "Google Drive denegó el acceso al archivo Excel.")
    throw new GoogleError("unavailable", `Error de Google Drive (${res.status}).`)
  }
  return res
}

export async function downloadXlsx(token: string, fileId: string): Promise<Uint8Array> {
  const meta = await (await driveFetch(token, `${DRIVE}/${encodeURIComponent(fileId)}?fields=size,mimeType&supportsAllDrives=true`)).json() as {
    size?: string
    mimeType?: string
  }
  if (meta.mimeType !== XLSX_MIME) throw new GoogleError("bad_request", "Solo se pueden usar así los archivos .xlsx.")
  if (Number(meta.size ?? 0) > MAX_BYTES) throw new GoogleError("bad_request", "El archivo Excel es demasiado grande (más de 5 MB).")
  const res = await driveFetch(token, `${DRIVE}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)
  return new Uint8Array(await res.arrayBuffer())
}

async function load(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  try {
    // deno-lint-ignore no-explicit-any
    await wb.xlsx.load(Buffer.from(bytes) as any)
  } catch {
    throw new GoogleError("bad_request", "No se pudo abrir el archivo Excel (¿está dañado o protegido con contraseña?).")
  }
  return wb
}

// Partes del libro que ExcelJS no sabe conservar al guardar.
export async function unsupportedParts(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes)
  const names = Object.keys(zip.files)
  const found: string[] = []
  if (names.some((n) => n.startsWith("xl/charts/"))) found.push("gráficos")
  if (names.some((n) => n.startsWith("xl/pivotTables/") || n.startsWith("xl/pivotCache/"))) found.push("tablas dinámicas")
  if (names.some((n) => n.startsWith("xl/slicers/") || n.startsWith("xl/timelines/"))) found.push("segmentaciones")
  if (names.some((n) => n.startsWith("xl/externalLinks/"))) found.push("vínculos a otros libros")
  return found
}

// ---------------------------------------------------------------------------
// Rangos A1
// ---------------------------------------------------------------------------
function colNumber(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

export function colLetters(n: number): string {
  let s = ""
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

type Area = { sheet: ExcelJS.Worksheet; c1: number; r1: number; c2: number | null; r2: number | null }

// "Hoja!A1:D10", "Hoja!A:D", "Hoja", "'Mi hoja'!B2", "A1:C3" (primera hoja).
function parseRange(wb: ExcelJS.Workbook, range: string): Area {
  const raw = range.trim()
  const bang = raw.lastIndexOf("!")
  let sheetName = bang >= 0 ? raw.slice(0, bang) : ""
  const ref = bang >= 0 ? raw.slice(bang + 1) : raw
  sheetName = sheetName.replace(/^'(.*)'$/, "$1").replace(/''/g, "'")
  let sheet: ExcelJS.Worksheet | undefined
  let cells = ref
  if (bang < 0) {
    // Sin «!»: puede ser el nombre de una hoja o una referencia de la primera hoja.
    sheet = wb.getWorksheet(raw.replace(/^'(.*)'$/, "$1"))
    if (sheet) cells = ""
  } else {
    sheet = wb.getWorksheet(sheetName)
  }
  sheet ??= bang < 0 ? wb.worksheets[0] : undefined
  if (!sheet) throw new GoogleError("not_found", `No existe la hoja «${sheetName}». Hojas: ${wb.worksheets.map((w) => w.name).join(", ")}.`)
  if (!cells) return { sheet, c1: 1, r1: 1, c2: null, r2: null }
  const m = cells.toUpperCase().match(/^\$?([A-Z]{1,3})?\$?(\d+)?(?::\$?([A-Z]{1,3})?\$?(\d+)?)?$/)
  if (!m || (!m[1] && !m[2])) throw new GoogleError("bad_request", `Rango no válido: «${range}».`)
  const c1 = m[1] ? colNumber(m[1]) : 1
  const r1 = m[2] ? Number(m[2]) : 1
  const c2 = m[3] ? colNumber(m[3]) : m[4] ? null : cells.includes(":") ? null : m[1] ? c1 : null
  const r2 = m[4] ? Number(m[4]) : cells.includes(":") ? null : m[2] ? r1 : null
  if (c1 > 16384 || r1 > 1_048_576 || (c2 !== null && c2 < c1) || (r2 !== null && r2 < r1)) {
    throw new GoogleError("bad_request", `Rango no válido: «${range}».`)
  }
  return { sheet, c1, r1, c2, r2 }
}

function quote(name: string): string {
  return /^[A-Za-z0-9_]+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`
}

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  if (v instanceof Date) {
    const iso = v.toISOString()
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ")
  }
  const o = v as unknown as Record<string, unknown>
  if ("result" in o) return cellValue(o.result as ExcelJS.CellValue)
  if (Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map((t) => t.text ?? "").join("")
  if ("text" in o) return String(o.text ?? "")
  if ("error" in o) return String(o.error)
  return null
}

// Última fila con algún valor entre las columnas c1..c2.
function lastUsedRow(sheet: ExcelJS.Worksheet, c1: number, c2: number): number {
  let last = 0
  sheet.eachRow({ includeEmpty: false }, (row, n) => {
    for (let c = c1; c <= c2; c++) {
      if (cellValue(row.getCell(c).value) !== null && cellValue(row.getCell(c).value) !== "") {
        last = n
        return
      }
    }
  })
  return last
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------
export async function xlsxInfo(bytes: Uint8Array) {
  const wb = await load(bytes)
  return {
    sheets: wb.worksheets.map((w) => ({ title: w.name, rows: w.actualRowCount, columns: w.actualColumnCount })),
  }
}

export async function xlsxRead(bytes: Uint8Array, range: string, maxCells: number): Promise<{ range: string; values: Cell[][]; truncated: boolean }> {
  const wb = await load(bytes)
  const a = parseRange(wb, range)
  const r2 = a.r2 ?? Math.max(a.r1, a.sheet.rowCount)
  const c2 = a.c2 ?? Math.max(a.c1, a.sheet.columnCount)
  const width = c2 - a.c1 + 1
  const values: Cell[][] = []
  let truncated = false
  for (let r = a.r1; r <= r2; r++) {
    if ((values.length + 1) * width > maxCells) {
      truncated = true
      break
    }
    const row = a.sheet.getRow(r)
    const cells: Cell[] = []
    for (let c = a.c1; c <= c2; c++) cells.push(cellValue(row.getCell(c).value))
    values.push(cells)
  }
  // Sin filas vacías al final.
  while (values.length && values[values.length - 1].every((v) => v === null || v === "")) values.pop()
  const shown = `${quote(a.sheet.name)}!${colLetters(a.c1)}${a.r1}:${colLetters(c2)}${a.r1 + Math.max(0, values.length - 1)}`
  return { range: shown, values, truncated }
}

// ---------------------------------------------------------------------------
// Escritura (nueva versión del archivo en Drive)
// ---------------------------------------------------------------------------
export async function xlsxWrite(
  token: string,
  fileId: string,
  mode: "append" | "update",
  range: string,
  values: Cell[][],
): Promise<{ updatedRange: string; updatedRows: number; updatedCells: number }> {
  const bytes = await downloadXlsx(token, fileId)
  const blocked = await unsupportedParts(bytes)
  if (blocked.length) {
    throw new GoogleError("bad_request", `Este Excel tiene ${blocked.join(" y ")}, que se perderían al guardarlo desde MarchaSolo. Pásalo a Google Sheets para que MarchaSolo pueda escribir en él.`)
  }
  const wb = await load(bytes)
  const a = parseRange(wb, range)
  const width = Math.max(1, ...values.map((r) => r.length))
  let startRow = a.r1
  if (mode === "append") {
    const c2 = a.c2 ?? Math.max(a.c1 + width - 1, a.sheet.columnCount)
    startRow = Math.max(a.r1, lastUsedRow(a.sheet, a.c1, c2) + 1)
  }
  values.forEach((rowValues, i) => {
    const row = a.sheet.getRow(startRow + i)
    rowValues.forEach((v, j) => {
      // Texto tal cual: aunque empiece por «=», no es una fórmula.
      row.getCell(a.c1 + j).value = v === null ? null : v
    })
    row.commit()
  })
  const out = await wb.xlsx.writeBuffer()
  await driveFetch(token, `${UPLOAD}/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": XLSX_MIME },
    body: new Uint8Array(out as ArrayBuffer),
  })
  const endRow = startRow + values.length - 1
  return {
    updatedRange: `${quote(a.sheet.name)}!${colLetters(a.c1)}${startRow}:${colLetters(a.c1 + width - 1)}${endRow}`,
    updatedRows: values.length,
    updatedCells: values.reduce((n, r) => n + r.length, 0),
  }
}
