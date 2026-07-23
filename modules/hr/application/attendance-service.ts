import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { parseTimeSheetXlsBuffer } from "./parse-timesheet-xls"
import { ensurePersonnelBranch } from "./personnel-branch-utils"

export function canReadAttendance(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "read"))
  )
}

export function canDeleteAttendance(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "delete"))
  )
}

export function canImportAttendance(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "create"))
  )
}

export async function listAttendanceEntries(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    from?: string | null
    to?: string | null
    page: number
    pageSize: number
  }
) {
  if (!canReadAttendance(params.roles)) throw new ForbiddenError()

  const { companyId, roles, branchId: branchIdParam = null, from, to, page, pageSize } = params

  const fromDate = from ? new Date(from + "T00:00:00.000Z") : null
  const toDate = to ? new Date(to + "T23:59:59.999Z") : null
  if (from && Number.isNaN(fromDate?.getTime() ?? NaN)) {
    throw new ValidationError("Invalid from")
  }
  if (to && Number.isNaN(toDate?.getTime() ?? NaN)) {
    throw new ValidationError("Invalid to")
  }

  let branchFilter: { branchId: string } | { branchId: { in: string[] } } | Record<string, never> = {}
  if (isAdminInAnyBranch(roles)) {
    if (branchIdParam) {
      const ok = await db.branch.findFirst({
        where: { id: branchIdParam, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      })
      if (!ok) throw new ValidationError("Invalid branch")
      branchFilter = { branchId: branchIdParam }
    }
  } else {
    const allowed = getBranchIds(roles)
    if (allowed.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (branchIdParam) {
      if (!allowed.includes(branchIdParam)) throw new ForbiddenError()
      branchFilter = { branchId: branchIdParam }
    } else {
      branchFilter = { branchId: { in: allowed } }
    }
  }

  const where = {
    companyId,
    ...branchFilter,
    ...((fromDate || toDate) && {
      workDate: {
        ...(fromDate && { gte: fromDate! }),
        ...(toDate && { lte: toDate! }),
      },
    }),
  }

  const [data, total] = await Promise.all([
    db.attendanceEntry.findMany({
      where,
      include: {
        personnel: { select: { id: true, displayName: true, rosterNo: true, jobGroup: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: [{ workDate: "desc" }, { personnel: { displayName: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.attendanceEntry.count({ where }),
  ])

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 0 }
}

export async function deleteAttendanceEntry(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
): Promise<void> {
  if (!canDeleteAttendance(params.roles)) throw new ForbiddenError()

  const row = await db.attendanceEntry.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, branchId: true },
  })
  if (!row) throw new NotFoundError("ไม่พบข้อมูล")

  if (!isAdminInAnyBranch(params.roles) && !getBranchIds(params.roles).includes(row.branchId)) {
    throw new ForbiddenError()
  }

  await db.attendanceEntry.delete({ where: { id: row.id } })
}

export const deleteAttendanceByDaySchema = z.object({
  branchId: z.string().uuid(),
  /** รูปแบบ YYYY-MM-DD */
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function deleteAttendanceByDay(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; workDate: string }
): Promise<{ deletedCount: number }> {
  if (!canDeleteAttendance(params.roles)) throw new ForbiddenError()

  const { companyId, roles, branchId, workDate } = params

  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")

  if (!isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError()
  }

  const day = new Date(`${workDate}T12:00:00.000Z`)

  const result = await db.attendanceEntry.deleteMany({
    where: { companyId, branchId, workDate: day },
  })

  return { deletedCount: result.count }
}

type GroupKey = string

function keyFor(r: { rosterNo: string; workDate: Date }): GroupKey {
  return `${r.rosterNo.trim()}\n${r.workDate.toISOString().slice(0, 10)}`
}

export async function importAttendanceFromXls(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    branchId: string | null
    file: Blob | null
    fileName: string
  }
) {
  if (!canImportAttendance(params.roles)) throw new ForbiddenError()

  const { companyId, roles, userId, branchId, file, fileName } = params

  if (!branchId) throw new ValidationError("ต้องระบุ branchId")

  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
  })
  if (!branch) throw new ValidationError("Invalid branch")

  if (!isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError()
  }

  if (!file) throw new ValidationError("ต้องแนบไฟล์")
  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length === 0) throw new ValidationError("ไฟล์ว่าง")

  let rows
  try {
    rows = parseTimeSheetXlsBuffer(buf)
  } catch {
    throw new ValidationError("อ่านไฟล์ไม่ได้")
  }

  const merged = new Map<
    GroupKey,
    { rosterNo: string; displayName: string; jobGroup: string | null; workDate: Date; punchTimes: string[] }
  >()
  for (const r of rows) {
    const k = keyFor(r)
    const cur = merged.get(k)
    if (cur) {
      cur.punchTimes.push(...r.punchTimes)
      if (r.displayName) cur.displayName = r.displayName
      if (r.jobGroup) cur.jobGroup = r.jobGroup
    } else {
      merged.set(k, { ...r })
    }
  }

  const workDates = [...merged.values()].map((r) => r.workDate)
  const workDate = workDates.length
    ? workDates.sort((a, b) => a.getTime() - b.getTime())[0]
    : null

  const result = await db.$transaction(async (tx) => {
    const batch = await tx.attendanceImportBatch.create({
      data: {
        companyId,
        branchId,
        fileName,
        workDate: workDate ?? undefined,
        rowCount: merged.size,
        createdById: userId,
      },
    })

    let personnelUpserted = 0
    let entriesUpserted = 0

    for (const r of merged.values()) {
      const p = await tx.personnel.upsert({
        where: { companyId_rosterNo: { companyId, rosterNo: r.rosterNo } },
        create: {
          companyId,
          branchId,
          rosterNo: r.rosterNo,
          displayName: r.displayName,
          jobGroup: r.jobGroup,
        },
        update: {
          displayName: r.displayName,
          jobGroup: r.jobGroup ?? undefined,
        },
      })
      personnelUpserted += 1
      await ensurePersonnelBranch(tx, p.id, branchId)

      await tx.attendanceEntry.upsert({
        where: {
          personnelId_workDate: { personnelId: p.id, workDate: r.workDate },
        },
        create: {
          companyId,
          branchId,
          personnelId: p.id,
          workDate: r.workDate,
          punchTimes: r.punchTimes,
          importBatchId: batch.id,
        },
        update: {
          punchTimes: r.punchTimes,
          importBatchId: batch.id,
          branchId,
          companyId,
        },
      })
      entriesUpserted += 1
    }

    return { batch, personnelUpserted, entriesUpserted }
  })

  return {
    importBatchId: result.batch.id,
    rowCount: result.batch.rowCount,
    personnelTouched: result.personnelUpserted,
    attendanceEntries: result.entriesUpserted,
  }
}
