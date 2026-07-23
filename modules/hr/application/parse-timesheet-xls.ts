import * as XLSX from "xlsx"

/** แถวจากไฟล์ Excel แบบบันทึกเวลา: A=ลำดับ, C=ชื่อ, D=กลุ่มงาน, E=วันที่ DD-MM-YYYY, F…=เวลา HH:MM ต่อเนื่อง */
export type ParsedTimeSheetRow = {
  rosterNo: string
  displayName: string
  jobGroup: string | null
  /** วันที่ (เวลาเป็น UTC เที่ยงคืน — ใช้กับ Prisma @db.Date) */
  workDate: Date
  punchTimes: string[]
}

const DDMMYYYY = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
const HHMM = /^(\d{1,2}):(\d{2})$/

function parseDisplayDate(s: string): Date | null {
  const t = s?.trim()
  if (!t) return null
  const m = t.match(DDMMYYYY)
  if (!m) return null
  const d = parseInt(m[1], 10)
  const mon = parseInt(m[2], 10) - 1
  const y = parseInt(m[3], 10)
  if (y < 2000) return null
  return new Date(Date.UTC(y, mon, d, 12, 0, 0, 0))
}

function normalizeTime(h: string, min: string): string {
  return `${h.padStart(2, "0")}:${min.padStart(2, "0")}`
}

/** Excel เก็บเวลาเป็นส่วนเศษของวัน (0–1) */
function fractionToHHMM(n: number): string | null {
  if (typeof n !== "number" || Number.isNaN(n) || n < 0 || n >= 1) return null
  const total = Math.round(n * 24 * 60)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function cellToPunch(raw: string | number | boolean | null | undefined): string | null {
  if (raw === "" || raw === null || raw === undefined) return null
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    if (raw > 0 && raw < 1) return fractionToHHMM(raw)
    return null
  }
  if (typeof raw === "boolean") return null
  const s = String(raw).trim()
  if (!s) return null
  const m = s.match(HHMM)
  if (m) return normalizeTime(m[1], m[2])
  return null
}

function looksLikeHeaderRow(row: unknown[], rosterCell: string, nameCell: string): boolean {
  if (/^\d+$/.test(rosterCell.trim()) && nameCell.trim().length > 0) return false
  if (/^(ลำดับ|no\.?|#|stt)$/i.test(rosterCell.trim())) return true
  if (/^(ชื่อ|name|รายชื่อ)/i.test(nameCell.trim())) return true
  return false
}

export function parseTimeSheetXlsBuffer(buffer: Buffer | ArrayBuffer): ParsedTimeSheetRow[] {
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | undefined)[]>(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][]

  const out: ParsedTimeSheetRow[] = []
  for (const row of rows) {
    if (!row || !Array.isArray(row)) continue
    const rosterCell = String(row[0] ?? "").trim()
    const nameCell = String(row[2] ?? "").trim()
    if (!rosterCell && !nameCell) continue
    if (looksLikeHeaderRow(row as unknown[], rosterCell, nameCell)) continue

    const rosterNo = rosterCell || "—"
    const displayName = nameCell || "—"
    const jobGroup = String(row[3] ?? "").trim() || null
    const dateStr = String(row[4] ?? "").trim()
    const workDate = parseDisplayDate(dateStr)
    if (!workDate) continue

    const punchTimes: string[] = []
    for (let c = 5; c < row.length; c++) {
      const p = cellToPunch(row[c] as string | number | boolean | null | undefined)
      if (p) punchTimes.push(p)
    }

    out.push({ rosterNo, displayName, jobGroup, workDate, punchTimes })
  }
  return out
}
