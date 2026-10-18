import type { AttendanceDayStatus } from "@prisma/client"

/** สแกนซ้ำภายในช่วงนี้นับเป็นครั้งเดียว (คนกดนิ้วซ้ำ) */
export const DUPLICATE_PUNCH_WINDOW_MS = 60_000

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** วันที่ตามปฏิทินของ timezone สาขา เป็น YYYY-MM-DD */
export function localDateKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at)
}

function timeZoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** ช่วงเวลา [start, end) ของวันตามปฏิทินสาขา */
export function zonedDayRange(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const midnightUtc = Date.parse(`${dateKey}T00:00:00.000Z`)
  const nextMidnightUtc = midnightUtc + 86_400_000
  const start = new Date(midnightUtc - timeZoneOffsetMs(new Date(midnightUtc), timeZone))
  const end = new Date(nextMidnightUtc - timeZoneOffsetMs(new Date(nextMidnightUtc), timeZone))
  return { start, end }
}

/** ค่าที่เก็บในคอลัมน์ @db.Date */
export function dateKeyToDbDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

export function dedupePunchTimes(times: Date[]): Date[] {
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime())
  const out: Date[] = []
  for (const t of sorted) {
    const last = out[out.length - 1]
    if (last && t.getTime() - last.getTime() < DUPLICATE_PUNCH_WINDOW_MS) continue
    out.push(t)
  }
  return out
}

export type DaySummary = {
  firstIn: Date
  lastOut: Date | null
  punchCount: number
  workedMinutes: number
  status: AttendanceDayStatus
}

export function summarizeDay(times: Date[]): DaySummary | null {
  const punches = dedupePunchTimes(times)
  if (punches.length === 0) return null
  const firstIn = punches[0]!
  if (punches.length === 1) {
    return { firstIn, lastOut: null, punchCount: 1, workedMinutes: 0, status: "SINGLE_PUNCH" }
  }
  const lastOut = punches[punches.length - 1]!
  return {
    firstIn,
    lastOut,
    punchCount: punches.length,
    workedMinutes: Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000),
    status: "COMPLETE",
  }
}

export type HomeBranchPunch = {
  personnelId: string
  punchAt: Date
  branchCode: string
  badgeNumber: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
}

export type HomeBranchDayRow = {
  id: string
  personnelId: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  badgeNumbers: string[]
  firstIn: Date
  lastOut: Date | null
  firstInBranchCode: string
  lastOutBranchCode: string | null
  punchCount: number
  workedMinutes: number
  status: AttendanceDayStatus
}

/** รวมสแกนของคนหนึ่งในวันเดียว แม้คนละสาขาเครื่อง — แถวนี้เป็นของสาขาหลัก */
export function summarizeHomeBranchDay(punches: HomeBranchPunch[]): HomeBranchDayRow[] {
  const byPerson = new Map<string, HomeBranchPunch[]>()
  for (const punch of punches) {
    const list = byPerson.get(punch.personnelId)
    if (list) list.push(punch)
    else byPerson.set(punch.personnelId, [punch])
  }

  const rows: HomeBranchDayRow[] = []
  for (const [personnelId, list] of byPerson) {
    const sorted = [...list].sort((a, b) => a.punchAt.getTime() - b.punchAt.getTime())
    const kept: HomeBranchPunch[] = []
    for (const punch of sorted) {
      const previous = kept[kept.length - 1]
      if (previous && punch.punchAt.getTime() - previous.punchAt.getTime() < DUPLICATE_PUNCH_WINDOW_MS) continue
      kept.push(punch)
    }
    const summary = summarizeDay(kept.map((punch) => punch.punchAt))
    if (!summary || kept.length === 0) continue
    const first = kept[0]!
    const last = kept.length > 1 ? kept[kept.length - 1]! : null
    rows.push({
      id: personnelId,
      personnelId,
      rosterNo: first.rosterNo,
      displayName: first.displayName,
      jobGroup: first.jobGroup,
      badgeNumbers: [...new Set(kept.map((punch) => punch.badgeNumber))],
      firstIn: summary.firstIn,
      lastOut: summary.lastOut,
      firstInBranchCode: first.branchCode,
      lastOutBranchCode: last?.branchCode ?? null,
      punchCount: summary.punchCount,
      workedMinutes: summary.workedMinutes,
      status: summary.status,
    })
  }
  rows.sort((a, b) => a.firstIn.getTime() - b.firstIn.getTime())
  return rows
}

export type PunchForSummary = { personnelId: string; punchAt: Date }

/** จัดกลุ่ม punch เป็น (personnelId, วันที่สาขา) แล้วสรุป */
export function summarizePunchesByDay(
  punches: PunchForSummary[],
  timeZone: string
): Map<string, { personnelId: string; dateKey: string; summary: DaySummary }> {
  const groups = new Map<string, { personnelId: string; dateKey: string; times: Date[] }>()
  for (const p of punches) {
    const dateKey = localDateKey(p.punchAt, timeZone)
    const key = `${p.personnelId}|${dateKey}`
    const g = groups.get(key)
    if (g) g.times.push(p.punchAt)
    else groups.set(key, { personnelId: p.personnelId, dateKey, times: [p.punchAt] })
  }
  const out = new Map<string, { personnelId: string; dateKey: string; summary: DaySummary }>()
  for (const [key, g] of groups) {
    const summary = summarizeDay(g.times)
    if (summary) out.set(key, { personnelId: g.personnelId, dateKey: g.dateKey, summary })
  }
  return out
}
