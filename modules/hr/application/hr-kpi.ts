import { shiftDateKey, shiftMonthKey } from "./attendance-day-calendar"
import { isDateKey } from "./attendance-daily-summary"

export type WorkforceGender = "MALE" | "FEMALE" | "UNSPECIFIED" | null
export type WorkforceNationality = "THAI" | "MYANMAR" | "OTHER" | null
export type WorkforceExitKind = "VOLUNTARY" | "INVOLUNTARY" | null

export type WorkforcePerson = {
  id: string
  branchId: string | null
  branchName: string
  departmentName: string
  birthDate: string | null
  startDate: string | null
  endDate: string | null
  gender: WorkforceGender
  nationality?: WorkforceNationality
  exitKind: WorkforceExitKind
  isActive: boolean
}

export type CountRow = { name: string; count: number }

export type WorkforceKpi = {
  headcount: number
  byBranch: CountRow[]
  byDepartment: CountRow[]
  averageTenureYears: number | null
  averageAgeYears: number | null
  ageBands: { under30: number; age30: number; age40: number; age50: number; unknown: number }
  gender: { male: number; female: number; unspecified: number }
  nationality: { thai: number; myanmar: number; other: number; unknown: number }
}

export type TurnoverKpi = {
  hires: number
  leavers: number
  voluntaryLeavers: number
  turnoverRate: number | null
  voluntaryTurnoverRate: number | null
  retentionRate: number | null
}

function yearsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  return (end - start) / (365.25 * 86_400_000)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(mean * 10) / 10
}

export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}

export function monthBounds(month: string, today: string): { start: string; asOf: string; dayBefore: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month) || !isDateKey(today)) return null
  const start = `${month}-01`
  if (!isDateKey(start)) return null
  const [year, monthNum] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year!, monthNum!, 0))
  const end = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`
  const asOf = month === today.slice(0, 7) && today < end ? today : end
  return { start, asOf, dayBefore: shiftDateKey(start, -1) }
}

/** คนที่เริ่มงานแล้วและยังไม่ออก ณ วันที่กำหนด */
export function employedAt(person: WorkforcePerson, date: string): boolean {
  if (person.endDate && person.endDate <= date) return false
  if (person.startDate) return person.startDate <= date
  return person.isActive && !person.endDate
}

function countBy(people: WorkforcePerson[], nameOf: (person: WorkforcePerson) => string): CountRow[] {
  const counts = new Map<string, number>()
  for (const person of people) {
    const name = nameOf(person)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"))
}

export function buildWorkforceKpi(people: WorkforcePerson[], asOf: string): WorkforceKpi {
  const employed = people.filter((person) => employedAt(person, asOf))
  const tenure = employed.flatMap((person) => (person.startDate ? [yearsBetween(person.startDate, asOf)] : []))
  const ages = employed.flatMap((person) => (person.birthDate ? [yearsBetween(person.birthDate, asOf)] : []))
  const ageBands = { under30: 0, age30: 0, age40: 0, age50: 0, unknown: 0 }
  for (const person of employed) {
    if (!person.birthDate) {
      ageBands.unknown += 1
      continue
    }
    const age = Math.floor(yearsBetween(person.birthDate, asOf))
    if (age <= 29) ageBands.under30 += 1
    else if (age <= 39) ageBands.age30 += 1
    else if (age <= 49) ageBands.age40 += 1
    else ageBands.age50 += 1
  }
  return {
    headcount: employed.length,
    byBranch: countBy(employed, (person) => person.branchName || "ยังไม่ระบุ"),
    byDepartment: countBy(employed, (person) => person.departmentName || "ยังไม่ระบุ"),
    averageTenureYears: average(tenure),
    averageAgeYears: average(ages),
    ageBands,
    gender: {
      male: employed.filter((person) => person.gender === "MALE").length,
      female: employed.filter((person) => person.gender === "FEMALE").length,
      unspecified: employed.filter((person) => person.gender !== "MALE" && person.gender !== "FEMALE").length,
    },
    nationality: {
      thai: employed.filter((person) => person.nationality === "THAI").length,
      myanmar: employed.filter((person) => person.nationality === "MYANMAR").length,
      other: employed.filter((person) => person.nationality === "OTHER").length,
      unknown: employed.filter((person) => !person.nationality).length,
    },
  }
}

export function buildTurnoverKpi(people: WorkforcePerson[], start: string, asOf: string): TurnoverKpi {
  const atStart = people.filter((person) => employedAt(person, shiftDateKey(start, -1)))
  const atEnd = people.filter((person) => employedAt(person, asOf))
  const endIds = new Set(atEnd.map((person) => person.id))
  const stayed = atStart.filter((person) => endIds.has(person.id)).length
  const hires = people.filter((person) => person.startDate != null && person.startDate >= start && person.startDate <= asOf).length
  const leavers = people.filter((person) => person.endDate != null && person.endDate >= start && person.endDate <= asOf)
  const averageHeadcount = (atStart.length + atEnd.length) / 2
  return {
    hires,
    leavers: leavers.length,
    voluntaryLeavers: leavers.filter((person) => person.exitKind === "VOLUNTARY").length,
    turnoverRate: percent(leavers.length, averageHeadcount),
    voluntaryTurnoverRate: percent(
      leavers.filter((person) => person.exitKind === "VOLUNTARY").length,
      averageHeadcount
    ),
    retentionRate: percent(stayed, atStart.length),
  }
}

export type HireLeavePoint = { month: string; hires: number; leavers: number }

/** เข้าใหม่และลาออกย้อนหลัง 6 เดือน รวมเดือนที่เลือก */
export function buildHireLeaveTrend(people: WorkforcePerson[], month: string, today: string): HireLeavePoint[] {
  const points: HireLeavePoint[] = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const key = shiftMonthKey(month, -offset)
    const bounds = monthBounds(key, today)
    if (!bounds) continue
    const turnover = buildTurnoverKpi(people, bounds.start, bounds.asOf)
    points.push({ month: key, hires: turnover.hires, leavers: turnover.leavers })
  }
  return points
}
