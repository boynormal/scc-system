import type { PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertAttendanceBranch } from "./attendance-access"
import { dateKeyToDbDate, dedupePunchTimes, isDateKey, zonedDayRange } from "./attendance-daily-summary"

function assertDateKey(date: string): void {
  if (!isDateKey(date)) throw new ValidationError("วันที่ไม่ถูกต้อง (YYYY-MM-DD)")
}

/** สรุปรายวันของสาขา + เลขสแกนที่ยังไม่ผูกแต่มีการสแกนในวันนั้น */
export async function listAttendanceDays(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; date: string }
) {
  assertDateKey(params.date)
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const { start, end } = zonedDayRange(params.date, branch.timezone)

  const [days, unmappedPunches, lastSync] = await Promise.all([
    db.attendanceDay.findMany({
      where: { companyId: params.companyId, branchId: branch.id, workDate: dateKeyToDbDate(params.date) },
      select: {
        id: true,
        firstIn: true,
        lastOut: true,
        punchCount: true,
        workedMinutes: true,
        status: true,
        personnel: {
          select: {
            id: true,
            rosterNo: true,
            displayName: true,
            jobGroup: true,
            attendanceBadges: { where: { branchId: branch.id }, select: { badgeNumber: true } },
          },
        },
      },
      orderBy: { firstIn: "asc" },
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

  return {
    branch,
    date: params.date,
    lastSyncedAt: lastSync?.lastSyncedAt ?? null,
    unmappedBadgesToday: unmappedPunches.length,
    rows: days.map(({ personnel, ...d }) => ({
      ...d,
      personnelId: personnel.id,
      rosterNo: personnel.rosterNo,
      displayName: personnel.displayName,
      jobGroup: personnel.jobGroup,
      badgeNumbers: personnel.attendanceBadges.map((b) => b.badgeNumber),
    })),
  }
}

/** เวลาสแกนทุกครั้งของคนหนึ่งในวันหนึ่งที่สาขา */
export async function listAttendanceDayPunches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; personnelId: string; date: string }
) {
  assertDateKey(params.date)
  const branch = await assertAttendanceBranch(db, { ...params, action: "read" })
  const { start, end } = zonedDayRange(params.date, branch.timezone)
  const punches = await db.attendancePunch.findMany({
    where: {
      companyId: params.companyId,
      branchId: branch.id,
      personnelId: params.personnelId,
      punchAt: { gte: start, lt: end },
    },
    select: { id: true, punchAt: true, verifyCode: true, badge: { select: { badgeNumber: true } }, device: { select: { name: true } } },
    orderBy: { punchAt: "asc" },
  })
  const counted = new Set(dedupePunchTimes(punches.map((p) => p.punchAt)).map((d) => d.getTime()))
  return punches.map((p) => ({
    id: p.id,
    punchAt: p.punchAt,
    verifyCode: p.verifyCode,
    badgeNumber: p.badge.badgeNumber,
    deviceName: p.device.name,
    counted: counted.has(p.punchAt.getTime()),
  }))
}
