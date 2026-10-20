import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { canReadHrAttendance } from "@/lib/hr-settings-nav-access"
import { listAttendanceBranches } from "./attendance-access"
import { listAttendanceReport } from "./attendance-day-service"
import { canReadPersonnel } from "./personnel-service"
import {
  buildHireLeaveTrend,
  buildTurnoverKpi,
  buildWorkforceKpi,
  monthBounds,
  type WorkforcePerson,
} from "./hr-kpi"
import { personnelDateKey } from "./personnel-date-time"

function dateKey(value: Date | null): string | null {
  return personnelDateKey(value)
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export async function getHrKpi(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; month: string; branchId?: string | null; departmentId?: string | null }
) {
  const readPeople = canReadPersonnel(params.roles)
  const readAttendance = canReadHrAttendance(params.roles)
  if (!readPeople && !readAttendance) throw new ForbiddenError()

  const bounds = monthBounds(params.month, todayKey())
  if (!bounds) throw new ValidationError("เดือนไม่ถูกต้อง")

  const attendanceBranches = readAttendance
    ? await listAttendanceBranches(db, { companyId: params.companyId, roles: params.roles })
    : []
  const branchIds = params.branchId ? [params.branchId] : attendanceBranches.map((branch) => branch.id)
  if (params.branchId && readAttendance && !attendanceBranches.some((branch) => branch.id === params.branchId)) {
    throw new ForbiddenError()
  }

  let workforce = null
  let turnover = null
  let trend: { month: string; hires: number; leavers: number }[] = []
  if (readPeople) {
    const allowed = new Set(getBranchIds(params.roles))
    const people = await db.personnel.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        ...(params.departmentId ? { departmentId: params.departmentId } : {}),
        ...(params.branchId
          ? { branchId: params.branchId }
          : isAdminInAnyBranch(params.roles)
            ? {}
            : { branchId: { in: [...allowed] } }),
      },
      select: {
        id: true,
        branchId: true,
        isActive: true,
        birthDate: true,
        startDate: true,
        endDate: true,
        gender: true,
        nationality: true,
        exitKind: true,
        jobGroup: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
      },
    })
    const rows: WorkforcePerson[] = people.map((person) => ({
      id: person.id,
      branchId: person.branchId,
      branchName: person.branch?.name ?? "ยังไม่ระบุ",
      departmentName: person.department?.name ?? person.jobGroup ?? "ยังไม่ระบุ",
      birthDate: dateKey(person.birthDate),
      startDate: dateKey(person.startDate),
      endDate: dateKey(person.endDate),
      gender: person.gender,
      nationality: person.nationality,
      exitKind: person.exitKind,
      isActive: person.isActive,
    }))
    workforce = buildWorkforceKpi(rows, bounds.asOf)
    turnover = buildTurnoverKpi(rows, bounds.start, bounds.asOf)
    trend = buildHireLeaveTrend(rows, params.month, todayKey())
  }

  let attendance = null
  if (readAttendance && branchIds.length > 0) {
    const reports = await Promise.all(
      branchIds.map((branchId) =>
        listAttendanceReport(db, {
          companyId: params.companyId,
          roles: params.roles,
          branchId,
          from: bounds.start,
          to: bounds.asOf,
          departmentId: params.departmentId,
        })
      )
    )
    const cards = reports.map((report) => report.cards)
    const sum = (pick: (card: (typeof cards)[number]) => number) => cards.reduce((total, card) => total + pick(card), 0)
    const daily = new Map<string, { date: string; present: number; noScan: number; singlePunch: number; leave: number }>()
    for (const report of reports) {
      for (const day of report.days) {
        const row = daily.get(day.date) ?? { date: day.date, present: 0, noScan: 0, singlePunch: 0, leave: 0 }
        row.present += day.present
        row.noScan += day.noScan
        row.singlePunch += day.singlePunch
        row.leave += day.leave.PERSONAL + day.leave.SICK + day.leave.INTRA_DAY
        daily.set(day.date, row)
      }
    }
    attendance = {
      leave: {
        PERSONAL: sum((card) => card.leave.PERSONAL),
        SICK: sum((card) => card.leave.SICK),
        ABSENT: sum((card) => card.leave.ABSENT),
        INTRA_DAY: sum((card) => card.leave.INTRA_DAY),
      },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      presentDays: sum((card) => card.presentDays),
      onTimeDays: sum((card) => card.onTimeDays),
      lateDays: sum((card) => card.lateDays),
      expectedDays: sum((card) => card.expectedDays),
      absentDays: sum((card) => card.absentDays),
      leaveDays: sum((card) => card.leaveDays),
      leaveHours: sum((card) => card.fullLeaveDays) * 8,
      manMinutes: sum((card) => card.manMinutes),
      confirmedOtMinutes: sum((card) => card.confirmedOtMinutes),
    }
  }

  return { month: params.month, asOf: bounds.asOf, workforce, turnover, trend, attendance }
}
