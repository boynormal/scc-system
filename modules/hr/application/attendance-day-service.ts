import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertAttendanceBranch } from "./attendance-access"
import { dedupePunchTimes, isDateKey, summarizeHomeBranchDay, zonedDayRange } from "./attendance-daily-summary"
import { presentOt, summarizeManHour, type OtRowView, type StoredOtDecision } from "./attendance-man-hour"

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

export const saveAttendanceDayNoteSchema = z.object({
  branchId: z.string().uuid(),
  personnelId: z.string().uuid(),
  date: z.string(),
  reason: z.enum(DAY_NOTE_REASONS).nullable(),
  note: z.string().max(500),
})

function assertDateKey(date: string): void {
  if (!isDateKey(date)) throw new ValidationError("วันที่ไม่ถูกต้อง (YYYY-MM-DD)")
}

/** สรุปรายวันของคนที่สาขาหลักตรงกับสาขาที่เปิด + เลขสแกนที่ยังไม่ผูกบนเครื่องสาขานั้น */
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
            jobGroup: true,
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
          jobGroup: punch.personnel.jobGroup,
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
      OR: [
        { branchId: branch.id, ...(movedAway.length ? { id: { notIn: movedAway } } : {}) },
        ...(movedHere.length ? [{ id: { in: movedHere } }] : []),
      ],
    },
    select: { id: true, rosterNo: true, displayName: true, jobGroup: true, branchId: true, branch: { select: { code: true } } },
  })
  for (const person of roster) {
    if (person.branchId && person.branch) homeByPerson.set(person.id, { id: person.branchId, code: person.branch.code })
  }
  const scannedIds = new Set(summarized.map((row) => row.personnelId))
  const absent = roster
    .filter((person) => !scannedIds.has(person.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"))
  const personnelIds = [...scannedIds, ...absent.map((person) => person.id)]
  const [decisions, notes] = await Promise.all([
    loadOtDecisions(db, params.companyId, params.date, personnelIds),
    loadDayNotes(db, params.companyId, params.date, personnelIds),
  ])
  const noteByPerson = new Map(notes.map((row) => [row.personnel_id, row.note || null]))
  const reasonByPerson = new Map(notes.map((row) => [row.personnel_id, row.reason]))
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
    const hours = summarizeManHour(row.firstIn, row.lastOut, branch.timezone)
    const stored = decisionByPerson.get(row.personnelId) ?? []
    return {
      ...row,
      manMinutes: hours.manMinutes,
      lateMinutes: hours.lateMinutes,
      otBefore: otView(hours.otBefore, stored.find((item) => item.side === "BEFORE") ?? null),
      otAfter: otView(hours.otAfter, stored.find((item) => item.side === "AFTER") ?? null),
      note: noteByPerson.get(row.personnelId) ?? null,
      noteReason: reasonByPerson.get(row.personnelId) ?? null,
      ...countedBranchFields(row.personnelId, homeByPerson, countedBranchByPerson, scanBranchesByPerson, branch),
    }
  })
  const absentRows = absent.map((person) => ({
    id: person.id,
    personnelId: person.id,
    rosterNo: person.rosterNo,
    displayName: person.displayName,
    jobGroup: person.jobGroup,
    badgeNumbers: [] as string[],
    firstIn: null,
    lastOut: null,
    firstInBranchCode: null,
    lastOutBranchCode: null,
    punchCount: 0,
    workedMinutes: 0,
    manMinutes: 0,
    lateMinutes: 0,
    otBefore: null,
    otAfter: null,
    status: "NO_SCAN" as const,
    note: noteByPerson.get(person.id) ?? null,
    noteReason: reasonByPerson.get(person.id) ?? null,
    ...countedBranchFields(person.id, homeByPerson, countedBranchByPerson, scanBranchesByPerson, branch),
  }))
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

async function loadDayNotes(db: PrismaClient, companyId: string, date: string, personnelIds: string[]) {
  if (personnelIds.length === 0) return []
  return db.$queryRaw<Array<{ personnel_id: string; reason: string | null; note: string }>>`
    SELECT personnel_id, reason, note
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
  }
) {
  assertDateKey(params.date)
  await assertHomeBranchPerson(db, params)
  const note = params.note.trim()
  if (!params.reason && !note) {
    await db.$executeRaw`
      DELETE FROM attendance_day_notes
      WHERE company_id = ${params.companyId}::uuid
        AND personnel_id = ${params.personnelId}::uuid
        AND work_date = ${params.date}::date
    `
    return { personnelId: params.personnelId, date: params.date, reason: null, note: null }
  }

  await db.$executeRaw`
    INSERT INTO attendance_day_notes (
      company_id, personnel_id, work_date, reason, note, updated_by_id, updated_at
    ) VALUES (
      ${params.companyId}::uuid,
      ${params.personnelId}::uuid,
      ${params.date}::date,
      ${params.reason},
      ${note},
      ${params.userId}::uuid,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (personnel_id, work_date)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      note = EXCLUDED.note,
      updated_by_id = EXCLUDED.updated_by_id,
      updated_at = CURRENT_TIMESTAMP
  `
  return { personnelId: params.personnelId, date: params.date, reason: params.reason, note: note || null }
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
