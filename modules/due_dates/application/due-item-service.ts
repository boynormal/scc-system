import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import {
  assertStartBeforeEnd,
  DUE_ALERT_LEVELS,
  daysRemaining,
  getDueAlertLevel,
  type DueAlertLevel,
} from "./due-date-utils"

const STATUSES = ["open", "closed", "cancelled"] as const

export const createDueItemSchema = z.object({
  branchId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  ownerUserId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
})

export const updateDueItemSchema = createDueItemSchema.partial().extend({
  status: z.enum(STATUSES).optional(),
})

export const renewDueItemSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().max(4000).nullable().optional(),
})

export type CreateDueItemInput = z.infer<typeof createDueItemSchema>
export type UpdateDueItemInput = z.infer<typeof updateDueItemSchema>

function canDueDates(roles: UserRole[], action: "create" | "read" | "update" | "delete"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "due_dates", action))
  )
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function isoDate(value: Date): string {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, "0")
  const d = String(value.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function assertBranchAllowed(
  db: PrismaClient,
  companyId: string,
  branchId: string,
  roles: UserRole[]
) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
  if (!isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }
}

function itemWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null
): Prisma.DueItemWhereInput {
  const isAdmin = isAdminInAnyBranch(roles)
  const allowed = getBranchIds(roles)
  const base: Prisma.DueItemWhereInput = { companyId }
  if (branchId) {
    if (!isAdmin && !allowed.includes(branchId)) {
      return { id: "00000000-0000-0000-0000-000000000000" }
    }
    return { ...base, branchId }
  }
  if (!isAdmin) {
    return { ...base, branchId: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }
  }
  return base
}

const itemInclude = {
  branch: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  renewals: {
    orderBy: { renewedAt: "desc" as const },
    take: 20,
    include: { renewedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.DueItemInclude

function serializeItem(row: Prisma.DueItemGetPayload<{ include: typeof itemInclude }>) {
  const remaining = daysRemaining(row.endDate)
  const alertLevel: DueAlertLevel | null = row.status === "open" ? getDueAlertLevel(row.endDate) : null
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch.name,
    title: row.title,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    daysRemaining: remaining,
    status: row.status,
    alertLevel,
    ownerUserId: row.ownerUserId,
    ownerName: row.owner ? `${row.owner.firstName} ${row.owner.lastName}`.trim() : null,
    notes: row.notes,
    createdById: row.createdById,
    createdByName: `${row.creator.firstName} ${row.creator.lastName}`.trim(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    renewals: row.renewals.map((r) => ({
      id: r.id,
      previousStartDate: isoDate(r.previousStartDate),
      previousEndDate: isoDate(r.previousEndDate),
      newStartDate: isoDate(r.newStartDate),
      newEndDate: isoDate(r.newEndDate),
      renewedAt: r.renewedAt.toISOString(),
      notes: r.notes,
      renewedByName: `${r.renewedBy.firstName} ${r.renewedBy.lastName}`.trim(),
    })),
  }
}

export async function listDueItems(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: string | null
    alertLevel?: string | null
    search?: string | null
  }
) {
  if (!canDueDates(params.roles, "read")) throw new ForbiddenError()
  const where: Prisma.DueItemWhereInput = itemWhere(params.companyId, params.roles, params.branchId)
  if (params.status && STATUSES.includes(params.status as (typeof STATUSES)[number])) {
    where.status = params.status as (typeof STATUSES)[number]
  }
    if (params.search?.trim()) {
      const q = params.search.trim()
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ]
    }
  const rows = await db.dueItem.findMany({
    where,
    include: itemInclude,
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    take: 200,
  })
  let data = rows.map(serializeItem)
  if (
    params.alertLevel &&
    DUE_ALERT_LEVELS.includes(params.alertLevel as DueAlertLevel)
  ) {
    data = data.filter((item) => item.alertLevel === params.alertLevel)
  }
  return { data }
}

export async function getDueItem(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDueDates(params.roles, "read")) throw new ForbiddenError()
  const row = await db.dueItem.findFirst({
    where: { id: params.id, ...itemWhere(params.companyId, params.roles) },
    include: itemInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการ")
  return { data: serializeItem(row) }
}

export async function createDueItem(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: CreateDueItemInput
  }
) {
  if (!canDueDates(params.roles, "create")) throw new ForbiddenError()
  await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)
  const startDate = parseDateOnly(params.input.startDate)
  const endDate = parseDateOnly(params.input.endDate)
  assertStartBeforeEnd(startDate, endDate)
  const row = await db.dueItem.create({
    data: {
      companyId: params.companyId,
      branchId: params.input.branchId,
      title: params.input.title,
      startDate,
      endDate,
      ownerUserId: params.input.ownerUserId ?? null,
      notes: params.input.notes ?? null,
      createdById: params.userId,
    },
    include: itemInclude,
  })
  return { data: serializeItem(row) }
}

export async function updateDueItem(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    id: string
    input: UpdateDueItemInput
  }
) {
  if (!canDueDates(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.dueItem.findFirst({
    where: { id: params.id, ...itemWhere(params.companyId, params.roles) },
    select: { id: true, startDate: true, endDate: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  if (params.input.branchId) {
    await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)
  }
  const startDate = params.input.startDate ? parseDateOnly(params.input.startDate) : existing.startDate
  const endDate = params.input.endDate ? parseDateOnly(params.input.endDate) : existing.endDate
  if (params.input.startDate || params.input.endDate) {
    assertStartBeforeEnd(startDate, endDate)
  }
  const row = await db.dueItem.update({
    where: { id: params.id },
    data: {
      ...(params.input.branchId ? { branchId: params.input.branchId } : {}),
      ...(params.input.title ? { title: params.input.title } : {}),
      ...(params.input.startDate ? { startDate } : {}),
      ...(params.input.endDate ? { endDate } : {}),
      ...(params.input.status ? { status: params.input.status } : {}),
      ...(params.input.ownerUserId !== undefined ? { ownerUserId: params.input.ownerUserId } : {}),
      ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    },
    include: itemInclude,
  })
  return { data: serializeItem(row) }
}

export async function closeDueItem(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDueDates(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.dueItem.findFirst({
    where: { id: params.id, ...itemWhere(params.companyId, params.roles) },
    select: { id: true, status: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  const row = await db.dueItem.update({
    where: { id: params.id },
    data: { status: "closed" },
    include: itemInclude,
  })
  return { data: serializeItem(row) }
}

export async function reopenDueItem(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDueDates(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.dueItem.findFirst({
    where: { id: params.id, ...itemWhere(params.companyId, params.roles) },
    select: { id: true, status: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  const row = await db.dueItem.update({
    where: { id: params.id },
    data: { status: "open" },
    include: itemInclude,
  })
  return { data: serializeItem(row) }
}

export async function renewDueItem(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    input: z.infer<typeof renewDueItemSchema>
  }
) {
  if (!canDueDates(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.dueItem.findFirst({
    where: { id: params.id, ...itemWhere(params.companyId, params.roles) },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  const startDate = parseDateOnly(params.input.startDate)
  const endDate = parseDateOnly(params.input.endDate)
  assertStartBeforeEnd(startDate, endDate)
  const row = await db.$transaction(async (tx) => {
    await tx.dueItemRenewal.create({
      data: {
        itemId: existing.id,
        previousStartDate: existing.startDate,
        previousEndDate: existing.endDate,
        newStartDate: startDate,
        newEndDate: endDate,
        renewedById: params.userId,
        notes: params.input.notes ?? null,
      },
    })
    return tx.dueItem.update({
      where: { id: existing.id },
      data: { startDate, endDate, status: "open" },
      include: itemInclude,
    })
  })
  return { data: serializeItem(row) }
}

export async function getDueSummary(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  if (!canDueDates(params.roles, "read")) throw new ForbiddenError()
  const rows = await db.dueItem.findMany({
    where: { ...itemWhere(params.companyId, params.roles, params.branchId), status: "open" },
    include: itemInclude,
    orderBy: { endDate: "asc" },
    take: 200,
  })
  const items = rows.map(serializeItem)
  const counts = { normal: 0, watch: 0, approaching: 0, urgent: 0, expired: 0 }
  for (const item of items) {
    if (item.alertLevel) counts[item.alertLevel] += 1
  }
  return { counts }
}

export async function listDueItemOwners(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canDueDates(params.roles, "read")) throw new ForbiddenError()
  const users = await db.user.findMany({
    where: { companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 200,
  })
  return {
    data: users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
  }
}

export async function listAccessibleBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canDueDates(params.roles, "read")) throw new ForbiddenError()
  const isAdmin = isAdminInAnyBranch(params.roles)
  const allowed = getBranchIds(params.roles)
  const branches = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(isAdmin ? {} : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: branches }
}
