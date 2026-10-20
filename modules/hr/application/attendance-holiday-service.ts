import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { permissionCoversBranch, readBranchSharing } from "@/shared/permissions/branch-sharing"
import { assertAttendanceBranch, canAttendanceAnyBranch } from "./attendance-access"
import type { HolidaySpan } from "./attendance-off-days"

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง")

export const holidayInputSchema = z
  .object({
    name: z.string().trim().min(1, "ต้องระบุชื่อวันหยุด").max(200),
    startDate: dateKey,
    endDate: dateKey,
    branchIds: z.array(z.string().uuid()).min(1, "ต้องเลือกอย่างน้อยหนึ่งสาขา"),
  })
  .refine((value) => value.endDate >= value.startDate, { message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม", path: ["endDate"] })

export type HolidayInput = z.infer<typeof holidayInputSchema>

function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

async function assertHolidayBranches(db: PrismaClient, companyId: string, roles: UserRole[], branchIds: string[]) {
  const unique = [...new Set(branchIds)]
  for (const branchId of unique) {
    await assertAttendanceBranch(db, { companyId, roles, branchId, action: "update" })
  }
  return unique
}

async function canUpdateBranches(db: PrismaClient, companyId: string, roles: UserRole[], branchIds: string[]) {
  if (branchIds.length === 0) return false
  const shared = (await readBranchSharing(db, companyId)).personnel.edit
  return branchIds.every((branchId) => permissionCoversBranch(roles, "hr_attendance", "update", branchId, shared))
}

const holidayInclude = {
  branches: {
    select: { branch: { select: { id: true, code: true, name: true } } },
  },
} as const

function presentHoliday(row: {
  id: string
  name: string
  startDate: Date
  endDate: Date
  branches: { branch: { id: string; code: string; name: string } }[]
}) {
  return {
    id: row.id,
    name: row.name,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    branches: row.branches
      .map((item) => item.branch)
      .sort((a, b) => a.code.localeCompare(b.code)),
  }
}

/** วันหยุดที่ทับช่วงวันที่ ใช้กรองการขาดงาน */
export async function listHolidaySpans(
  db: PrismaClient,
  companyId: string,
  from: string,
  to: string
): Promise<HolidaySpan[]> {
  const rows = await db.attendanceHoliday.findMany({
    where: {
      companyId,
      startDate: { lte: toDbDate(to) },
      endDate: { gte: toDbDate(from) },
    },
    select: {
      startDate: true,
      endDate: true,
      branches: { select: { branchId: true } },
    },
  })
  return rows.map((row) => ({
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    branchIds: row.branches.map((item) => item.branchId),
  }))
}

export async function listAttendanceHolidays(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; year: number }
) {
  if (!canAttendanceAnyBranch(params.roles, "read")) throw new ForbiddenError()
  if (!Number.isInteger(params.year) || params.year < 2000 || params.year > 2100) {
    throw new ValidationError("ปีไม่ถูกต้อง")
  }
  const from = `${params.year}-01-01`
  const to = `${params.year}-12-31`
  const rows = await db.attendanceHoliday.findMany({
    where: {
      companyId: params.companyId,
      startDate: { lte: toDbDate(to) },
      endDate: { gte: toDbDate(from) },
    },
    include: holidayInclude,
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  })
  const shared = (await readBranchSharing(db, params.companyId)).personnel.view
  const visible = rows.filter((row) =>
    row.branches.some((item) => permissionCoversBranch(params.roles, "hr_attendance", "read", item.branch.id, shared))
  )
  const data = await Promise.all(
    visible.map(async (row) => ({
      ...presentHoliday(row),
      canUpdate: await canUpdateBranches(
        db,
        params.companyId,
        params.roles,
        row.branches.map((item) => item.branch.id)
      ),
    }))
  )
  return data
}

export async function createAttendanceHoliday(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: HolidayInput }
) {
  const branchIds = await assertHolidayBranches(db, params.companyId, params.roles, params.input.branchIds)
  const created = await db.attendanceHoliday.create({
    data: {
      companyId: params.companyId,
      name: params.input.name,
      startDate: toDbDate(params.input.startDate),
      endDate: toDbDate(params.input.endDate),
      branches: { create: branchIds.map((branchId) => ({ branchId })) },
    },
    include: holidayInclude,
  })
  return presentHoliday(created)
}

export async function updateAttendanceHoliday(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: HolidayInput }
) {
  const existing = await db.attendanceHoliday.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, branches: { select: { branchId: true } } },
  })
  if (!existing) throw new NotFoundError("ไม่พบวันหยุด")
  const allowed = await canUpdateBranches(
    db,
    params.companyId,
    params.roles,
    existing.branches.map((item) => item.branchId)
  )
  if (!allowed) throw new ForbiddenError()
  const branchIds = await assertHolidayBranches(db, params.companyId, params.roles, params.input.branchIds)
  const updated = await db.$transaction(async (tx) => {
    await tx.attendanceHolidayBranch.deleteMany({ where: { holidayId: existing.id } })
    return tx.attendanceHoliday.update({
      where: { id: existing.id },
      data: {
        name: params.input.name,
        startDate: toDbDate(params.input.startDate),
        endDate: toDbDate(params.input.endDate),
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
      },
      include: holidayInclude,
    })
  })
  return presentHoliday(updated)
}

export async function deleteAttendanceHoliday(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const existing = await db.attendanceHoliday.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, branches: { select: { branchId: true } } },
  })
  if (!existing) throw new NotFoundError("ไม่พบวันหยุด")
  const allowed = await canUpdateBranches(
    db,
    params.companyId,
    params.roles,
    existing.branches.map((item) => item.branchId)
  )
  if (!allowed) throw new ForbiddenError()
  await db.attendanceHoliday.delete({ where: { id: existing.id } })
}
