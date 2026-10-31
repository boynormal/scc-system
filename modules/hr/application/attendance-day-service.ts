import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertAttendanceBranch } from "./attendance-access"
import { dedupePunchTimes, isDateKey, localDateKey, reportDateKey, summarizeDay, summarizeHomeBranchDay, zonedDateTime, zonedDayRange } from "./attendance-daily-summary"
import { presentOt, summarizeManHour, type OtRowView, type StoredOtDecision } from "./attendance-man-hour"
import { effectiveDayTimes, type StoredTimeConfirmation } from "./attendance-time-confirmation"
import {
  buildAttendanceReport,
  buildExceptionGroups,
  buildStaffingCells,
  countsOnBranch,
  dateKeysInRange,
  type ReportFact,
} from "./attendance-report"
import { listHolidaySpans } from "./attendance-holiday-service"
import { isOffDay, shouldSkipOffDay } from "./attendance-off-days"

export const decideAttendanceOtSchema = z.object({
  branchId: z.string().uuid(),
  personnelId: z.string().uuid(),
  date: z.string(),
  side: z.enum(["BEFORE", "AFTER"]),
  decision: z.enum(["OT", "NOT_OT"]),
  minutes: z.number().int().min(1).max(24 * 60).optional(),
})

export const DAY_NOTE_REASONS = ["PERSONAL", "SICK", "ABSENT", "INTRA_DAY"] as const

export const saveAttendanceDayBranchSchema = z.object({
  branchId: z.string().uuid(),
  personnelId: z.string().uuid(),
  date: z.string(),
  countedBranchId: z.string().uuid(),
})

export const saveAttendanceTimeConfirmationSchema = z.object({
  branchId: z.string().uuid(),
  personnelId: z.string().uuid(),
  date: z.string(),
  inTime: z.string(),
  outTime: z.string(),
})

export const saveAttendanceDayNoteSchema = z.object({
  branchId: z.string().uuid(),
  personnelId: z.string().uuid(),
  date: z.string(),
  reason: z.enum(DAY_NOTE_REASONS).nullable(),
  note: z.string().max(500),
  showOnReport: z.boolean().optional(),
})

function assertDateKey(date: string): void {
  if (!isDateKey(date)) throw new ValidationError("วันที่ไม่ถูกต้อง (YYYY-MM-DD)")
}

/** สรุปรายวันของคนที่สาขาหลักตรงกับสาขาที่เปิด และผูกเลขสแกนแล้ว + เลขสแกนที่ยังไม่ผูกบนเครื่องสาขานั้น */
export async function listAttendanceDays(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; date: string }
) {
  assertDateKey(params.date)
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const { start, end } = zonedDayRange(params.date, branch.timezone)

  const assignments = await loadDayBranchAssignments(db, params.companyId, params.date)
  const countedBranchByPerson = new Map(assignments.map((row) => [row.personnel_id, row.branch_id]))
  const movedAway = assignments.filter((row) => row.branch_id !== branch.id).map((row) => row.personnel_id)
  const movedHere = assignments.filter((row) => row.branch_id === branch.id).map((row) => row.personnel_id)

  const [punches, unmappedPunches, lastSync] = await Promise.all([
    db.attendancePunch.findMany({
      where: {
        companyId: params.companyId,
        personnelId: { not: null },
        punchAt: { gte: start, lt: end },
        personnel: {
          companyId: params.companyId,
          deletedAt: null,
          OR: [
            { branchId: branch.id, ...(movedAway.length ? { id: { notIn: movedAway } } : {}) },
            ...(movedHere.length ? [{ id: { in: movedHere } }] : []),
          ],
        },
      },
      select: {
        punchAt: true,
        personnelId: true,
        branch: { select: { id: true, code: true } },
        badge: { select: { badgeNumber: true } },
        personnel: {
          select: {
            rosterNo: true,
            displayName: true,
            jobGroupRef: { select: { name: true } },
            branchId: true,
            branch: { select: { code: true } },
          },
        },
      },
    }),
    db.attendancePunch.groupBy({
      by: ["badgeId"],
      where: { branchId: branch.id, personnelId: null, punchAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    db.attendanceDevice.findFirst({
      where: { branchId: branch.id, isActive: true },
      orderBy: { lastSyncedAt: { sort: "desc", nulls: "last" } },
      select: { lastSyncedAt: true },
    }),
  ])

  const summarized = summarizeHomeBranchDay(
    punches.flatMap((punch) => {
      if (!punch.personnelId || !punch.personnel) return []
      return [
        {
          personnelId: punch.personnelId,
          punchAt: punch.punchAt,
          branchCode: punch.branch.code,
          badgeNumber: punch.badge.badgeNumber,
          rosterNo: punch.personnel.rosterNo,
          displayName: punch.personnel.displayName,
          jobGroup: punch.personnel.jobGroupRef?.name ?? null,
        },
      ]
    })
  )
  const scanBranchesByPerson = new Map<string, Map<string, string>>()
  const homeByPerson = new Map<string, { id: string; code: string }>()
  for (const punch of punches) {
    if (!punch.personnelId || !punch.personnel?.branchId || !punch.personnel.branch) continue
    homeByPerson.set(punch.personnelId, { id: punch.personnel.branchId, code: punch.personnel.branch.code })
    const scans = scanBranchesByPerson.get(punch.personnelId) ?? new Map<string, string>()
    scans.set(punch.branch.id, punch.branch.code)
    scanBranchesByPerson.set(punch.personnelId, scans)
  }

  const roster = await db.personnel.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      attendanceBadges: { some: {} },
      OR: [
        { branchId: branch.id, ...(movedAway.length ? { id: { notIn: movedAway } } : {}) },
        ...(movedHere.length ? [{ id: { in: movedHere } }] : []),
      ],
    },
    select: {
      id: true,
      rosterNo: true,
      displayName: true,
      jobGroupRef: { select: { name: true } },
      branchId: true,
      branch: { select: { code: true } },
    },
  })
  for (const person of roster) {
    if (person.branchId && person.branch) homeByPerson.set(person.id, { id: person.branchId, code: person.branch.code })
  }
  const scannedIds = new Set(summarized.map((row) => row.personnelId))
  const holidays = await listHolidaySpans(db, params.companyId, params.date, params.date)
  const absent = isOffDay(params.date, branch.id, holidays)
    ? []
    : roster
        .filter((person) => !scannedIds.has(person.id))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"))
  const personnelIds = [...scannedIds, ...absent.map((person) => person.id)]
  const [decisions, notes, confirmations] = await Promise.all([
    loadOtDecisions(db, params.companyId, params.date, personnelIds),
    loadDayNotes(db, params.companyId, params.date, personnelIds),
    loadTimeConfirmations(db, params.companyId, params.date, personnelIds),
  ])
  const noteByPerson = new Map(notes.map((row) => [row.personnel_id, row.note || null]))
  const reasonByPerson = new Map(notes.map((row) => [row.personnel_id, row.reason]))
  const showNoteByPerson = new Map(notes.map((row) => [row.personnel_id, row.show_on_report]))
  const decisionByPerson = new Map<string, StoredOtDecision[]>()
  for (const decision of decisions) {
    const list = decisionByPerson.get(decision.personnel_id) ?? []
    list.push({
      side: decision.side,
      punchAt: decision.punch_at,
      decision: decision.decision,
      otMinutes: decision.ot_minutes,
    })
    decisionByPerson.set(decision.personnel_id, list)
  }

  const scannedRows = summarized.map((row) => {
    const stored = decisionByPerson.get(row.personnelId) ?? []
    const times = applyConfirmedTimes(row.firstIn, row.lastOut, confirmations.get(row.personnelId) ?? null, branch.timezone, stored)
    return {
      ...row,
      ...times,
      note: noteByPerson.get(row.personnelId) ?? null,
      noteReason: reasonByPerson.get(row.personnelId) ?? null,
      showOnReport: showNoteByPerson.get(row.personnelId) ?? true,
      ...countedBranchFields(row.personnelId, homeByPerson, countedBranchByPerson, scanBranchesByPerson, branch),
    }
  })
  const absentRows = absent.map((person) => {
    const stored = decisionByPerson.get(person.id) ?? []
    const times = applyConfirmedTimes(null, null, confirmations.get(person.id) ?? null, branch.timezone, stored)
    return {
      id: person.id,
      personnelId: person.id,
      rosterNo: person.rosterNo,
      displayName: person.displayName,
      jobGroup: person.jobGroupRef?.name ?? null,
      badgeNumbers: [] as string[],
      firstInBranchCode: null,
      lastOutBranchCode: null,
      punchCount: 0,
      workedMinutes: 0,
      ...times,
      note: noteByPerson.get(person.id) ?? null,
      noteReason: reasonByPerson.get(person.id) ?? null,
      showOnReport: showNoteByPerson.get(person.id) ?? true,
      ...countedBranchFields(person.id, homeByPerson, countedBranchByPerson, scanBranchesByPerson, branch),
    }
  })
  const rows = [...scannedRows, ...absentRows]

  return {
    branch,
    date: params.date,
    lastSyncedAt: lastSync?.lastSyncedAt ?? null,
    unmappedBadgesToday: unmappedPunches.length,
    rows,
  }
}

type OtDecisionRow = {
  personnel_id: string
  side: "BEFORE" | "AFTER"
  punch_at: Date
  decision: "OT" | "NOT_OT"
  ot_minutes: number
}

function otView(candidate: ReturnType<typeof summarizeManHour>["otBefore"], decision: StoredOtDecision | null): OtRowView | null {
  return presentOt(candidate, decision)
}

type TimeConfirmationRow = {
  personnel_id: string
  work_date?: string
  confirmed_in: Date
  confirmed_out: Date | null
  source_first_in: Date | null
  source_last_out: Date | null
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function personDateKey(personnelId: unknown, workDate: unknown): string {
  return `${String(personnelId).toLowerCase()}|${reportDateKey(workDate)}`
}

function toStoredConfirmation(row: TimeConfirmationRow): StoredTimeConfirmation | null {
  const confirmedIn = asDate(row.confirmed_in)
  if (!confirmedIn) return null
  return {
    confirmedIn,
    confirmedOut: asDate(row.confirmed_out),
    sourceFirstIn: asDate(row.source_first_in),
    sourceLastOut: asDate(row.source_last_out),
  }
}

function applyConfirmedTimes(
  scanFirstIn: Date | null,
  scanLastOut: Date | null,
  confirmation: TimeConfirmationRow | null,
  timeZone: string,
  stored: StoredOtDecision[]
) {
  const storedConfirmation = confirmation ? toStoredConfirmation(confirmation) : null
  const effective = effectiveDayTimes(scanFirstIn, scanLastOut, storedConfirmation)
  const hours = effective.firstIn ? summarizeManHour(effective.firstIn, effective.lastOut, timeZone) : null
  return {
    firstIn: effective.firstIn,
    lastOut: effective.lastOut,
    scanFirstIn,
    scanLastOut,
    timeConfirmed: effective.confirmed,
    outConfirmed: storedConfirmation?.confirmedOut != null,
    scanChanged: effective.scanChanged,
    status: (effective.firstIn && effective.lastOut ? "COMPLETE" : effective.firstIn ? "SINGLE_PUNCH" : "NO_SCAN") as
      | "COMPLETE"
      | "SINGLE_PUNCH"
      | "NO_SCAN",
    manMinutes: hours?.manMinutes ?? 0,
    lateMinutes: hours?.lateMinutes ?? 0,
    otBefore: hours ? otView(hours.otBefore, stored.find((item) => item.side === "BEFORE") ?? null) : null,
    otAfter: hours ? otView(hours.otAfter, stored.find((item) => item.side === "AFTER") ?? null) : null,
  }
}

async function loadTimeConfirmations(db: PrismaClient, companyId: string, date: string, personnelIds: string[]) {
  if (personnelIds.length === 0) return new Map<string, TimeConfirmationRow>()
  const rows = await db.$queryRaw<TimeConfirmationRow[]>`
    SELECT personnel_id, confirmed_in, confirmed_out, source_first_in, source_last_out
    FROM attendance_time_confirmations
    WHERE company_id = ${companyId}::uuid
      AND work_date = ${date}::date
      AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
  `
  return new Map(rows.map((row) => [row.personnel_id, row]))
}

async function loadOtDecisions(db: PrismaClient, companyId: string, date: string, personnelIds: string[]) {
  if (personnelIds.length === 0) return []
  return db.$queryRaw<OtDecisionRow[]>`
    SELECT personnel_id, side::text AS side, punch_at, decision::text AS decision, ot_minutes
    FROM attendance_ot_decisions
    WHERE company_id = ${companyId}::uuid
      AND work_date = ${date}::date
      AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
  `
}

async function loadDayBranchAssignments(db: PrismaClient, companyId: string, date: string) {
  return db.$queryRaw<Array<{ personnel_id: string; branch_id: string; code: string }>>`
    SELECT a.personnel_id, a.branch_id, b.code
    FROM attendance_day_branches a
    INNER JOIN branches b ON b.id = a.branch_id
    WHERE a.company_id = ${companyId}::uuid
      AND a.work_date = ${date}::date
  `
}

function countedBranchFields(
  personnelId: string,
  homeByPerson: Map<string, { id: string; code: string }>,
  countedBranchByPerson: Map<string, string>,
  scanBranchesByPerson: Map<string, Map<string, string>>,
  pageBranch: { id: string; code: string }
) {
  const home = homeByPerson.get(personnelId) ?? { id: pageBranch.id, code: pageBranch.code }
  const countedId = countedBranchByPerson.get(personnelId) ?? home.id
  const scans = [...(scanBranchesByPerson.get(personnelId)?.entries() ?? [])].map(([id, code]) => ({ id, code }))
  const countedCode = scans.find((item) => item.id === countedId)?.code ?? (countedId === home.id ? home.code : pageBranch.code)
  return {
    homeBranchId: home.id,
    homeBranchCode: home.code,
    countedBranchId: countedId,
    countedBranchCode: countedCode,
    scanBranches: scans,
  }
}

export async function listAttendanceReport(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId: string
    from: string
    to: string
    departmentId?: string | null
    jobGroupId?: string | null
  }
) {
  const dates = dateKeysInRange(params.from, params.to)
  if (!dates) throw new ValidationError("ช่วงวันที่ไม่ถูกต้อง หรือยาวเกิน 62 วัน")
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const holidays = await listHolidaySpans(db, params.companyId, dates[0]!, dates[dates.length - 1]!)
  const { start } = zonedDayRange(dates[0]!, branch.timezone)
  const { end } = zonedDayRange(dates[dates.length - 1]!, branch.timezone)

  const assignments = await db.$queryRaw<Array<{ personnel_id: string; branch_id: string; work_date: string }>>`
    SELECT personnel_id, branch_id, to_char(work_date, 'YYYY-MM-DD') AS work_date
    FROM attendance_day_branches
    WHERE company_id = ${params.companyId}::uuid
      AND work_date >= ${params.from}::date
      AND work_date <= ${params.to}::date
  `
  const countedByPersonDate = new Map(assignments.map((row) => [personDateKey(row.personnel_id, row.work_date), row.branch_id]))
  const movedHere = [...new Set(assignments.filter((row) => row.branch_id === branch.id).map((row) => row.personnel_id))]

  const roster = await db.personnel.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.jobGroupId ? { jobGroupId: params.jobGroupId } : {}),
      OR: [{ branchId: branch.id }, ...(movedHere.length ? [{ id: { in: movedHere } }] : [])],
    },
    select: {
      id: true,
      displayName: true,
      jobGroup: true,
      jobGroupRef: { select: { name: true } },
      branchId: true,
      departmentId: true,
      jobGroupId: true,
      department: { select: { name: true } },
      attendanceBadges: { select: { id: true }, take: 1 },
    },
    orderBy: { displayName: "asc" },
  })

  const offDates = dates.filter((date) => isOffDay(date, branch.id, holidays))
  const holidayDates = dates.filter((date) =>
    holidays.some((holiday) => holiday.branchIds.includes(branch.id) && date >= holiday.startDate && date <= holiday.endDate)
  )
  const personnelIds = roster.map((person) => person.id)
  if (personnelIds.length === 0) {
    return {
      branch: { id: branch.id, code: branch.code, name: branch.name, timezone: branch.timezone },
      from: params.from,
      to: params.to,
      ...buildAttendanceReport(dates, []),
      exceptions: buildExceptionGroups([]),
      staffing: buildStaffingCells([]),
      offDates,
      holidayDates,
    }
  }

  const [punches, decisions, notes, confirmations] = await Promise.all([
    db.attendancePunch.findMany({
      where: {
        companyId: params.companyId,
        personnelId: { in: personnelIds },
        punchAt: { gte: start, lt: end },
      },
      select: { personnelId: true, punchAt: true },
    }),
    db.$queryRaw<Array<{ personnel_id: string; work_date: string; side: "BEFORE" | "AFTER"; punch_at: Date; decision: "OT" | "NOT_OT"; ot_minutes: number }>>`
      SELECT personnel_id, to_char(work_date, 'YYYY-MM-DD') AS work_date, side::text AS side, punch_at, decision::text AS decision, ot_minutes
      FROM attendance_ot_decisions
      WHERE company_id = ${params.companyId}::uuid
        AND work_date >= ${params.from}::date
        AND work_date <= ${params.to}::date
        AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
    `,
    db.$queryRaw<Array<{ personnel_id: string; work_date: string; reason: string | null; note: string | null; show_on_report: boolean }>>`
      SELECT personnel_id, to_char(work_date, 'YYYY-MM-DD') AS work_date, reason, note, show_on_report
      FROM attendance_day_notes
      WHERE company_id = ${params.companyId}::uuid
        AND work_date >= ${params.from}::date
        AND work_date <= ${params.to}::date
        AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
    `,
    db.$queryRaw<TimeConfirmationRow[]>`
      SELECT personnel_id, to_char(work_date, 'YYYY-MM-DD') AS work_date, confirmed_in, confirmed_out, source_first_in, source_last_out
      FROM attendance_time_confirmations
      WHERE company_id = ${params.companyId}::uuid
        AND work_date >= ${params.from}::date
        AND work_date <= ${params.to}::date
        AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
    `,
  ])

  const punchesByPersonDate = new Map<string, Date[]>()
  for (const punch of punches) {
    if (!punch.personnelId) continue
    const date = localDateKey(punch.punchAt, branch.timezone)
    const key = `${punch.personnelId}|${date}`
    const list = punchesByPersonDate.get(key)
    if (list) list.push(punch.punchAt)
    else punchesByPersonDate.set(key, [punch.punchAt])
  }
  const decisionByKey = new Map<string, StoredOtDecision>()
  for (const row of decisions) {
    decisionByKey.set(`${personDateKey(row.personnel_id, row.work_date)}|${row.side}`, {
      side: row.side,
      punchAt: row.punch_at,
      decision: row.decision,
      otMinutes: row.ot_minutes,
    })
  }
  const noteByKey = new Map(notes.map((row) => [personDateKey(row.personnel_id, row.work_date), row]))
  const confirmationByKey = new Map(confirmations.map((row) => [personDateKey(row.personnel_id, row.work_date), row]))

  const facts: ReportFact[] = []
  for (const date of dates) {
    for (const person of roster) {
      const dayKey = personDateKey(person.id, date)
      const counted = countedByPersonDate.get(dayKey) ?? null
      if (!countsOnBranch(person.branchId, counted, branch.id)) continue
      const punches = punchesByPersonDate.get(`${person.id}|${date}`) ?? []
      if (shouldSkipOffDay(date, branch.id, holidays, punches.length > 0)) continue
      const summary = summarizeDay(punches)
      const savedNote = noteByKey.get(dayKey)
      const times = applyConfirmedTimes(
        summary?.firstIn ?? null,
        summary?.lastOut ?? null,
        confirmationByKey.get(dayKey) ?? null,
        branch.timezone,
        [
          decisionByKey.get(`${dayKey}|BEFORE`),
          decisionByKey.get(`${dayKey}|AFTER`),
        ].filter((item): item is StoredOtDecision => item != null)
      )
      facts.push({
        date,
        personnelId: person.id,
        displayName: person.displayName,
        departmentId: person.departmentId,
        jobGroupId: person.jobGroupId,
        departmentName: person.department?.name ?? person.jobGroup,
        jobGroupName: person.jobGroupRef?.name ?? person.jobGroup ?? null,
        status: times.status,
        manMinutes: times.manMinutes,
        lateMinutes: times.lateMinutes,
        otBefore: times.otBefore ? { minutes: times.otBefore.minutes, status: times.otBefore.status } : null,
        otAfter: times.otAfter ? { minutes: times.otAfter.minutes, status: times.otAfter.status } : null,
        noteReason: savedNote?.reason ?? null,
        note: savedNote && savedNote.show_on_report === false ? null : savedNote?.note?.trim() || null,
        firstIn: times.firstIn,
        lastOut: times.lastOut,
      })
    }
  }

  const linkedIds = new Set(roster.filter((person) => person.attendanceBadges.length > 0).map((person) => person.id))
  const linked = facts.filter((fact) => linkedIds.has(fact.personnelId))

  return {
    branch: { id: branch.id, code: branch.code, name: branch.name, timezone: branch.timezone },
    from: params.from,
    to: params.to,
    ...buildAttendanceReport(dates, facts, branch.timezone),
    exceptions: buildExceptionGroups(linked, branch.timezone),
    staffing: buildStaffingCells(linked, branch.timezone),
    offDates,
    holidayDates,
  }
}

async function loadDayNotes(db: PrismaClient, companyId: string, date: string, personnelIds: string[]) {
  if (personnelIds.length === 0) return []
  return db.$queryRaw<Array<{ personnel_id: string; reason: string | null; note: string; show_on_report: boolean }>>`
    SELECT personnel_id, reason, note, show_on_report
    FROM attendance_day_notes
    WHERE company_id = ${companyId}::uuid
      AND work_date = ${date}::date
      AND personnel_id IN (${Prisma.join(personnelIds.map((id) => Prisma.sql`${id}::uuid`))})
  `
}

async function assertHomeBranchPerson(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; personnelId: string }
) {
  const branch = await assertAttendanceBranch(db, { ...params, action: "update" })
  const person = await db.personnel.findFirst({
    where: { id: params.personnelId, companyId: params.companyId, branchId: branch.id, deletedAt: null },
    select: { id: true },
  })
  if (!person) throw new ValidationError("ไม่พบพนักงานในสาขานี้")
  return branch
}

/** ยืนยันหรือปฏิเสธ OT ของสแกนแรกก่อนเข้า หรือสแกนสุดท้ายหลังเลิก */
export async function decideAttendanceOt(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    branchId: string
    personnelId: string
    date: string
    side: "BEFORE" | "AFTER"
    decision: "OT" | "NOT_OT"
    minutes?: number
  }
) {
  assertDateKey(params.date)
  const branch = await assertHomeBranchPerson(db, params)

  const { start, end } = zonedDayRange(params.date, branch.timezone)
  const punches = await db.attendancePunch.findMany({
    where: { companyId: params.companyId, personnelId: params.personnelId, punchAt: { gte: start, lt: end } },
    select: { punchAt: true },
    orderBy: { punchAt: "asc" },
  })
  const times = dedupePunchTimes(punches.map((punch) => punch.punchAt))
  const firstIn = times[0]
  if (!firstIn) throw new ValidationError("ไม่มีสแกนในวันนี้")
  const lastOut = times.length > 1 ? times[times.length - 1]! : null
  const hours = summarizeManHour(firstIn, lastOut, branch.timezone)
  const candidate = params.side === "BEFORE" ? hours.otBefore : hours.otAfter
  if (!candidate) throw new ValidationError("ไม่มีรายการ OT ให้ยืนยัน")

  const decidedAt = new Date()
  if (
    params.decision === "OT" &&
    (params.minutes == null || !Number.isInteger(params.minutes) || params.minutes < 1 || params.minutes > 24 * 60)
  ) {
    throw new ValidationError("จำนวนนาที OT ต้องเป็นจำนวนเต็ม 1 ถึง 1440")
  }
  const otMinutes = params.decision === "OT" ? params.minutes! : 0
  await db.$executeRaw`
    INSERT INTO attendance_ot_decisions (
      company_id, personnel_id, work_date, side, punch_at, decision, ot_minutes, decided_by_id, decided_at, updated_at
    ) VALUES (
      ${params.companyId}::uuid,
      ${params.personnelId}::uuid,
      ${params.date}::date,
      CAST(${params.side} AS "AttendanceOtSide"),
      ${candidate.at},
      CAST(${params.decision} AS "AttendanceOtDecisionKind"),
      ${otMinutes},
      ${params.userId}::uuid,
      ${decidedAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (personnel_id, work_date, side)
    DO UPDATE SET
      punch_at = EXCLUDED.punch_at,
      decision = EXCLUDED.decision,
      ot_minutes = EXCLUDED.ot_minutes,
      decided_by_id = EXCLUDED.decided_by_id,
      decided_at = EXCLUDED.decided_at,
      updated_at = CURRENT_TIMESTAMP
  `

  return {
    personnelId: params.personnelId,
    date: params.date,
    side: params.side,
    at: candidate.at.toISOString(),
    minutes: otMinutes,
    status: params.decision,
  }
}

/** ยืนยันสาขาที่ให้นับคนและ Man hour ในวันนั้น เลือกสาขาหลักคือลบการยืนยัน */
export async function saveAttendanceDayBranch(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    branchId: string
    personnelId: string
    date: string
    countedBranchId: string
  }
) {
  assertDateKey(params.date)
  const pageBranch = await assertAttendanceBranch(db, { ...params, action: "update" })
  const person = await db.personnel.findFirst({
    where: { id: params.personnelId, companyId: params.companyId, deletedAt: null },
    select: { id: true, branchId: true },
  })
  if (!person?.branchId) throw new ValidationError("ไม่พบพนักงาน")

  const { start, end } = zonedDayRange(params.date, pageBranch.timezone)
  const [assignment, scanBranches] = await Promise.all([
    db.$queryRaw<Array<{ branch_id: string }>>`
      SELECT branch_id FROM attendance_day_branches
      WHERE company_id = ${params.companyId}::uuid
        AND personnel_id = ${params.personnelId}::uuid
        AND work_date = ${params.date}::date
      LIMIT 1
    `,
    db.attendancePunch.findMany({
      where: { companyId: params.companyId, personnelId: params.personnelId, punchAt: { gte: start, lt: end } },
      select: { branchId: true },
      distinct: ["branchId"],
    }),
  ])
  const currentCounted = assignment[0]?.branch_id ?? person.branchId
  if (currentCounted !== pageBranch.id && person.branchId !== pageBranch.id) {
    throw new ValidationError("คนนี้ไม่ได้อยู่ในรายวันของสาขานี้")
  }

  const allowed = new Set<string>([person.branchId, ...scanBranches.map((row) => row.branchId)])
  if (!allowed.has(params.countedBranchId)) throw new ValidationError("เลือกได้เฉพาะสาขาหลักหรือสาขาที่สแกนในวันนี้")

  if (params.countedBranchId === person.branchId) {
    await db.$executeRaw`
      DELETE FROM attendance_day_branches
      WHERE company_id = ${params.companyId}::uuid
        AND personnel_id = ${params.personnelId}::uuid
        AND work_date = ${params.date}::date
    `
  } else {
    await db.$executeRaw`
      INSERT INTO attendance_day_branches (
        company_id, personnel_id, work_date, branch_id, decided_by_id, decided_at, updated_at
      ) VALUES (
        ${params.companyId}::uuid,
        ${params.personnelId}::uuid,
        ${params.date}::date,
        ${params.countedBranchId}::uuid,
        ${params.userId}::uuid,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (personnel_id, work_date)
      DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        decided_by_id = EXCLUDED.decided_by_id,
        decided_at = EXCLUDED.decided_at,
        updated_at = CURRENT_TIMESTAMP
    `
  }

  const counted = await db.branch.findFirst({
    where: { id: params.countedBranchId, companyId: params.companyId },
    select: { id: true, code: true },
  })
  return {
    personnelId: params.personnelId,
    date: params.date,
    countedBranchId: params.countedBranchId,
    countedBranchCode: counted?.code ?? "",
  }
}

/** บันทึกหรือลบเวลายืนยันของ HR เวลาว่างทั้งคู่คือลบ ไม่แก้แถวสแกน */
export async function saveAttendanceTimeConfirmation(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    branchId: string
    personnelId: string
    date: string
    inTime: string
    outTime: string
  }
) {
  assertDateKey(params.date)
  const branch = await assertAttendanceBranch(db, { ...params, action: "update" })
  const person = await db.personnel.findFirst({
    where: { id: params.personnelId, companyId: params.companyId, deletedAt: null },
    select: { id: true, branchId: true },
  })
  const assignment = await db.$queryRaw<Array<{ branch_id: string }>>`
    SELECT branch_id
    FROM attendance_day_branches
    WHERE company_id = ${params.companyId}::uuid
      AND personnel_id = ${params.personnelId}::uuid
      AND work_date = ${params.date}::date
  `
  if (!person || !countsOnBranch(person.branchId, assignment[0]?.branch_id ?? null, branch.id)) {
    throw new ValidationError("ไม่พบพนักงานในสาขานี้")
  }

  const inTime = params.inTime.trim()
  const outTime = params.outTime.trim()
  if (!inTime && !outTime) {
    await db.$executeRaw`
      DELETE FROM attendance_time_confirmations
      WHERE company_id = ${params.companyId}::uuid
        AND personnel_id = ${params.personnelId}::uuid
        AND work_date = ${params.date}::date
    `
    return { personnelId: params.personnelId, date: params.date, confirmed: false }
  }
  if (!inTime) throw new ValidationError("ต้องระบุเวลาเข้าก่อน เวลาออกใส่ทีหลังได้")
  const confirmedIn = zonedDateTime(params.date, inTime, branch.timezone)
  const confirmedOut = outTime ? zonedDateTime(params.date, outTime, branch.timezone) : null
  if (!confirmedIn || (outTime && !confirmedOut)) throw new ValidationError("เวลาไม่ถูกต้อง")
  if (confirmedOut && confirmedOut.getTime() <= confirmedIn.getTime()) {
    throw new ValidationError("เวลาออกต้องอยู่หลังเวลาเข้า")
  }

  const { start, end } = zonedDayRange(params.date, branch.timezone)
  const punches = await db.attendancePunch.findMany({
    where: { companyId: params.companyId, personnelId: params.personnelId, punchAt: { gte: start, lt: end } },
    select: { punchAt: true },
    orderBy: { punchAt: "asc" },
  })
  const times = dedupePunchTimes(punches.map((punch) => punch.punchAt))
  const sourceFirstIn = times[0] ?? null
  const sourceLastOut = times.length > 1 ? times[times.length - 1]! : null

  await db.$executeRaw`
    INSERT INTO attendance_time_confirmations (
      company_id, personnel_id, work_date, confirmed_in, confirmed_out,
      source_first_in, source_last_out, decided_by_id, decided_at, updated_at
    ) VALUES (
      ${params.companyId}::uuid,
      ${params.personnelId}::uuid,
      ${params.date}::date,
      ${confirmedIn},
      ${confirmedOut},
      ${sourceFirstIn},
      ${sourceLastOut},
      ${params.userId}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (personnel_id, work_date)
    DO UPDATE SET
      confirmed_in = EXCLUDED.confirmed_in,
      confirmed_out = EXCLUDED.confirmed_out,
      source_first_in = EXCLUDED.source_first_in,
      source_last_out = EXCLUDED.source_last_out,
      decided_by_id = EXCLUDED.decided_by_id,
      decided_at = EXCLUDED.decided_at,
      updated_at = CURRENT_TIMESTAMP
  `
  return { personnelId: params.personnelId, date: params.date, confirmed: true }
}

/** บันทึกหรือลบหมายเหตุของคนหนึ่งในวันนั้น ข้อความว่างคือลบ */
export async function saveAttendanceDayNote(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    branchId: string
    personnelId: string
    date: string
    reason: (typeof DAY_NOTE_REASONS)[number] | null
    note: string
    showOnReport?: boolean
  }
) {
  assertDateKey(params.date)
  await assertHomeBranchPerson(db, params)
  const note = params.note.trim()
  const showOnReport = params.showOnReport ?? true
  if (!params.reason && !note) {
    await db.$executeRaw`
      DELETE FROM attendance_day_notes
      WHERE company_id = ${params.companyId}::uuid
        AND personnel_id = ${params.personnelId}::uuid
        AND work_date = ${params.date}::date
    `
    return { personnelId: params.personnelId, date: params.date, reason: null, note: null, showOnReport: false }
  }

  await db.$executeRaw`
    INSERT INTO attendance_day_notes (
      company_id, personnel_id, work_date, reason, note, show_on_report, updated_by_id, updated_at
    ) VALUES (
      ${params.companyId}::uuid,
      ${params.personnelId}::uuid,
      ${params.date}::date,
      ${params.reason},
      ${note},
      ${showOnReport},
      ${params.userId}::uuid,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (personnel_id, work_date)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      note = EXCLUDED.note,
      show_on_report = EXCLUDED.show_on_report,
      updated_by_id = EXCLUDED.updated_by_id,
      updated_at = CURRENT_TIMESTAMP
  `
  return { personnelId: params.personnelId, date: params.date, reason: params.reason, note: note || null, showOnReport }
}

/**
 * จำนวนคนที่สาขาหลักตรงกับสาขาที่เปิด และมีสแกนในวันนั้น
 * คำจำกัดความเดียวกับจำนวนแถวของ listAttendanceDays
 */
export async function listAttendanceDayCounts(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string }
): Promise<{ days: { date: string; present: number }[] }> {
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const rows = await db.$queryRaw<Array<{ date: string; present: number }>>`
    SELECT to_char(p.punch_at AT TIME ZONE ${branch.timezone}, 'YYYY-MM-DD') AS date,
           COUNT(DISTINCT p.personnel_id)::int AS present
    FROM attendance_punches p
    INNER JOIN personnel pe ON pe.id = p.personnel_id
    WHERE p.company_id = ${params.companyId}::uuid
      AND pe.company_id = ${params.companyId}::uuid
      AND pe.branch_id = ${branch.id}::uuid
      AND pe.deleted_at IS NULL
      AND p.personnel_id IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `
  return {
    days: rows.flatMap((row) => {
      const present = Number(row.present)
      if (!isDateKey(row.date) || !Number.isFinite(present) || present <= 0) return []
      return [{ date: row.date, present }]
    }),
  }
}

/** เวลาสแกนทุกครั้งของคนหนึ่งในวันนั้น ทุกสาขาเครื่อง */
export async function listAttendanceDayPunches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; personnelId: string; date: string }
) {
  assertDateKey(params.date)
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const person = await db.personnel.findFirst({
    where: { id: params.personnelId, companyId: params.companyId, branchId: branch.id, deletedAt: null },
    select: { id: true },
  })
  if (!person) return []

  const { start, end } = zonedDayRange(params.date, branch.timezone)
  const punches = await db.attendancePunch.findMany({
    where: {
      companyId: params.companyId,
      personnelId: params.personnelId,
      punchAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      punchAt: true,
      verifyCode: true,
      branch: { select: { code: true } },
      badge: { select: { badgeNumber: true } },
      device: { select: { name: true } },
    },
    orderBy: { punchAt: "asc" },
  })
  const counted = new Set(dedupePunchTimes(punches.map((p) => p.punchAt)).map((d) => d.getTime()))
  return punches.map((p) => ({
    id: p.id,
    punchAt: p.punchAt,
    verifyCode: p.verifyCode,
    badgeNumber: p.badge.badgeNumber,
    deviceName: p.device.name,
    branchCode: p.branch.code,
    counted: counted.has(p.punchAt.getTime()),
  }))
}
