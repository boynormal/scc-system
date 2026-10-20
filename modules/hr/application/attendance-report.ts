import { shiftDateKey } from "./attendance-day-calendar"
import { isDateKey } from "./attendance-daily-summary"

export const REPORT_LEAVE_REASONS = ["PERSONAL", "SICK", "ABSENT", "INTRA_DAY"] as const
export type ReportLeaveReason = (typeof REPORT_LEAVE_REASONS)[number]
export type LeaveCounts = Record<ReportLeaveReason, number>

export type ReportOtStatus = "PENDING" | "OT" | "NOT_OT"
export type ReportDayStatus = "COMPLETE" | "SINGLE_PUNCH" | "NO_SCAN"

export type ReportOtFact = { minutes: number; status: ReportOtStatus } | null

export type ReportFact = {
  date: string
  personnelId: string
  displayName: string
  departmentName: string | null
  status: ReportDayStatus
  manMinutes: number
  lateMinutes: number
  otBefore: ReportOtFact
  otAfter: ReportOtFact
  noteReason: string | null
  note: string | null
  firstIn: Date | null
  lastOut: Date | null
}

export type ExceptionRow = {
  personnelId: string
  displayName: string
  status: ReportDayStatus
  late: boolean
  minutes: number
  noteReason: ReportLeaveReason | null
  note: string | null
  firstIn: string | null
  lastOut: string | null
}

export type ExceptionGroup = {
  date: string
  minutes: number
  rows: ExceptionRow[]
}

export type ReportPersonDay = {
  date: string
  status: ReportDayStatus
  manMinutes: number
  lateMinutes: number
  otBeforeMinutes: number
  otAfterMinutes: number
  noteReason: string | null
}

export type ReportDayRow = {
  date: string
  present: number
  manMinutes: number
  confirmedOtMinutes: number
  pendingOtCount: number
  singlePunch: number
  noScan: number
  leave: LeaveCounts
}

export type ReportPersonRow = {
  personnelId: string
  displayName: string
  departmentName: string | null
  presentDays: number
  manMinutes: number
  lateMinutes: number
  otBeforeMinutes: number
  otAfterMinutes: number
  pendingOtCount: number
  singlePunch: number
  noScan: number
  leave: LeaveCounts
  days: ReportPersonDay[]
}

export type AttendanceReport = {
  cards: {
    presentPeople: number
    manMinutes: number
    confirmedOtMinutes: number
    pendingOtCount: number
    leave: LeaveCounts
    presentDays: number
    onTimeDays: number
    lateDays: number
    expectedDays: number
    absentDays: number
    leaveDays: number
    fullLeaveDays: number
  }
  days: ReportDayRow[]
  people: ReportPersonRow[]
}

export function emptyLeaveCounts(): LeaveCounts {
  return { PERSONAL: 0, SICK: 0, ABSENT: 0, INTRA_DAY: 0 }
}

/** รวมวันที่จาก from ถึง to ไม่เกิน 62 วัน คืน null เมื่อช่วงไม่ถูกต้อง */
export function dateKeysInRange(from: string, to: string, maxDays = 62): string[] | null {
  if (!isDateKey(from) || !isDateKey(to) || from > to) return null
  const keys: string[] = []
  let cursor = from
  while (keys.length < maxDays) {
    keys.push(cursor)
    if (cursor === to) return keys
    const next = shiftDateKey(cursor, 1)
    if (next === cursor) return null
    cursor = next
  }
  return null
}

/** ไม่มีแถวลงสาขาให้นับที่สาขาหลัก คนที่ถูกย้ายออกไม่ปรากฏในสาขาหลัก */
export function countsOnBranch(
  homeBranchId: string | null,
  countedBranchId: string | null,
  openBranchId: string
): boolean {
  const counted = countedBranchId ?? homeBranchId
  return counted === openBranchId
}

function leaveReason(reason: string | null): ReportLeaveReason | null {
  return REPORT_LEAVE_REASONS.find((item) => item === reason) ?? null
}

function confirmedMinutes(item: ReportOtFact): number {
  return item?.status === "OT" ? item.minutes : 0
}

function pendingCount(item: ReportOtFact): number {
  return item?.status === "PENDING" ? 1 : 0
}

export function buildAttendanceReport(dates: string[], facts: ReportFact[]): AttendanceReport {
  const leave = emptyLeaveCounts()
  const presentPeople = new Set<string>()
  let manMinutes = 0
  let confirmedOtMinutes = 0
  let pendingOtCount = 0
  let presentDays = 0
  let onTimeDays = 0
  let lateDays = 0
  let expectedDays = 0
  let absentDays = 0
  let leaveDays = 0
  let fullLeaveDays = 0

  const dayBuckets = new Map<string, ReportDayRow>()
  for (const date of dates) {
    dayBuckets.set(date, {
      date,
      present: 0,
      manMinutes: 0,
      confirmedOtMinutes: 0,
      pendingOtCount: 0,
      singlePunch: 0,
      noScan: 0,
      leave: emptyLeaveCounts(),
    })
  }

  const people = new Map<string, ReportPersonRow>()

  for (const fact of facts) {
    const day = dayBuckets.get(fact.date)
    if (!day) continue
    const reason = leaveReason(fact.noteReason)
    const confirmed = confirmedMinutes(fact.otBefore) + confirmedMinutes(fact.otAfter)
    const pending = pendingCount(fact.otBefore) + pendingCount(fact.otAfter)

    expectedDays += 1
    const present = fact.status !== "NO_SCAN"
    const absent = fact.status === "NO_SCAN" || reason === "ABSENT"
    if (present) {
      day.present += 1
      presentPeople.add(fact.personnelId)
      presentDays += 1
      if (fact.lateMinutes > 0) lateDays += 1
      else onTimeDays += 1
    }
    if (absent) absentDays += 1
    if (reason === "PERSONAL" || reason === "SICK" || reason === "INTRA_DAY") leaveDays += 1
    if (reason === "PERSONAL" || reason === "SICK") fullLeaveDays += 1
    if (fact.status === "SINGLE_PUNCH") day.singlePunch += 1
    if (fact.status === "NO_SCAN") day.noScan += 1
    day.manMinutes += fact.manMinutes
    day.confirmedOtMinutes += confirmed
    day.pendingOtCount += pending
    if (reason) day.leave[reason] += 1

    manMinutes += fact.manMinutes
    confirmedOtMinutes += confirmed
    pendingOtCount += pending
    if (reason) leave[reason] += 1

    const person = people.get(fact.personnelId) ?? {
      personnelId: fact.personnelId,
      displayName: fact.displayName,
      departmentName: fact.departmentName,
      presentDays: 0,
      manMinutes: 0,
      lateMinutes: 0,
      otBeforeMinutes: 0,
      otAfterMinutes: 0,
      pendingOtCount: 0,
      singlePunch: 0,
      noScan: 0,
      leave: emptyLeaveCounts(),
      days: [],
    }
    if (fact.status !== "NO_SCAN") person.presentDays += 1
    if (fact.status === "SINGLE_PUNCH") person.singlePunch += 1
    if (fact.status === "NO_SCAN") person.noScan += 1
    person.manMinutes += fact.manMinutes
    person.lateMinutes += fact.lateMinutes
    person.otBeforeMinutes += confirmedMinutes(fact.otBefore)
    person.otAfterMinutes += confirmedMinutes(fact.otAfter)
    person.pendingOtCount += pending
    if (reason) person.leave[reason] += 1
    person.days.push({
      date: fact.date,
      status: fact.status,
      manMinutes: fact.manMinutes,
      lateMinutes: fact.lateMinutes,
      otBeforeMinutes: confirmedMinutes(fact.otBefore),
      otAfterMinutes: confirmedMinutes(fact.otAfter),
      noteReason: reason,
    })
    people.set(fact.personnelId, person)
  }

  for (const person of people.values()) {
    person.days.sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    cards: {
      presentPeople: presentPeople.size,
      manMinutes,
      confirmedOtMinutes,
      pendingOtCount,
      leave,
      presentDays,
      onTimeDays,
      lateDays,
      expectedDays,
      absentDays,
      leaveDays,
      fullLeaveDays,
    },
    days: dates.map((date) => dayBuckets.get(date)!),
    people: [...people.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "th")),
  }
}

function isExceptionFact(fact: ReportFact): boolean {
  const note = fact.note?.trim() ?? ""
  return fact.lateMinutes > 0 || fact.status !== "COMPLETE" || leaveReason(fact.noteReason) != null || note.length > 0
}

/** เฉพาะวันผิดปกติ จัดกลุ่มจากวันที่ใหม่ไปเก่า นาทีของวันคือผลรวมนาทีสาย */
export function buildExceptionGroups(facts: ReportFact[]): ExceptionGroup[] {
  const groups = new Map<string, ExceptionRow[]>()
  for (const fact of facts) {
    if (!isExceptionFact(fact)) continue
    const list = groups.get(fact.date) ?? []
    list.push({
      personnelId: fact.personnelId,
      displayName: fact.displayName,
      status: fact.status,
      late: fact.lateMinutes > 0,
      minutes: fact.lateMinutes,
      noteReason: leaveReason(fact.noteReason),
      note: fact.note?.trim() || null,
      firstIn: fact.firstIn ? fact.firstIn.toISOString() : null,
      lastOut: fact.lastOut ? fact.lastOut.toISOString() : null,
    })
    groups.set(fact.date, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => ({
      date,
      minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
      rows: rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "th")),
    }))
}
