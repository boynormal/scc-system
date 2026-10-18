import { isDateKey } from "./attendance-daily-summary"

export type DayPresent = { date: string; present: number }
export type MonthPresent = { month: string; total: number }

const MONTH_RE = /^\d{4}-\d{2}$/

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** เลื่อนวันที่ปฏิทิน YYYY-MM-DD โดยไม่พึ่ง timezone ของเครื่อง */
export function shiftDateKey(dateKey: string, days: number): string {
  if (!isDateKey(dateKey) || !Number.isInteger(days)) return dateKey
  const [year, month, day] = dateKey.split("-").map(Number)
  const next = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** เลื่อนเดือน YYYY-MM ข้ามปีได้ */
export function shiftMonthKey(month: string, delta: number): string {
  if (!MONTH_RE.test(month) || !Number.isInteger(delta)) return month
  const [year, monthNum] = month.split("-").map(Number)
  const next = new Date(Date.UTC(year!, (monthNum ?? 1) - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

/** ผลรวมจำนวนคนต่อวันในแต่ละเดือน เรียงจากเดือนเก่าไปใหม่ */
export function sumPresentByMonth(days: DayPresent[]): MonthPresent[] {
  const totals = new Map<string, number>()
  for (const day of days) {
    if (!isDateKey(day.date) || day.present <= 0) continue
    const month = monthKeyOf(day.date)
    totals.set(month, (totals.get(month) ?? 0) + day.present)
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))
}

/** ช่องปฏิทินของเดือนนั้น วันอาทิตย์อยู่คอลัมน์แรก ช่องว่างเป็น null */
export function buildMonthCells(month: string): Array<string | null> {
  if (!MONTH_RE.test(month)) return []
  const [year, monthNum] = month.split("-").map(Number)
  if (!year || !monthNum || monthNum < 1 || monthNum > 12) return []
  const first = new Date(Date.UTC(year, monthNum - 1, 1))
  const days = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const cells: Array<string | null> = []
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(null)
  for (let day = 1; day <= days; day++) {
    cells.push(`${year}-${pad(monthNum)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
