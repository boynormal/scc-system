import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertFuelAnywhere, assertFuelInBranch, fuelBranchScope, fuelBranchWhere } from "./fuel-access"
import { toNumber } from "./fuel-calc"
import { parseOrThrow } from "./fuel-validation"

const decimalInput = z.coerce.number().finite()

export const createFuelTankSchema = z.object({
  branchId: z.string().uuid(),
  fuelTypeId: z.string().uuid(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(255),
  capacity: decimalInput.positive().max(9_999_999_999),
  minLevel: decimalInput.min(0).max(9_999_999_999).optional(),
  isActive: z.boolean().optional(),
})

export const updateFuelTankSchema = createFuelTankSchema.partial()

export type CreateFuelTankInput = z.input<typeof createFuelTankSchema>
export type UpdateFuelTankInput = z.input<typeof updateFuelTankSchema>

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export const fuelTankInclude = {
  branch: { select: { id: true, name: true } },
  fuelType: { select: { id: true, code: true, name: true, unit: true } },
} satisfies Prisma.FuelTankInclude

export function serializeFuelTank(row: Prisma.FuelTankGetPayload<{ include: typeof fuelTankInclude }>) {
  const capacity = toNumber(row.capacity)
  const currentQty = toNumber(row.currentQty)
  const minLevel = toNumber(row.minLevel)
  const avgCost = toNumber(row.avgCost)
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    fuelTypeId: row.fuelTypeId,
    fuelTypeCode: row.fuelType.code,
    fuelTypeName: row.fuelType.name,
    unit: row.fuelType.unit,
    code: row.code,
    name: row.name,
    capacity,
    minLevel,
    currentQty,
    avgCost,
    stockValue: Math.round(currentQty * avgCost * 100) / 100,
    fillPercent: capacity > 0 ? Math.round((currentQty / capacity) * 1000) / 10 : 0,
    isLow: currentQty < minLevel,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type FuelTankDto = ReturnType<typeof serializeFuelTank>

async function assertBranch(db: PrismaClient, companyId: string, branchId: string) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
}

async function assertFuelType(db: PrismaClient, companyId: string, fuelTypeId: string, currentId?: string) {
  const row = await db.fuelType.findFirst({
    where: { id: fuelTypeId, companyId },
    select: { id: true, isActive: true },
  })
  if (!row) throw new ValidationError("ชนิดน้ำมันไม่ถูกต้อง")
  if (!row.isActive && fuelTypeId !== currentId) throw new ValidationError("ชนิดน้ำมันนี้ปิดใช้งานแล้ว")
}

export async function listFuelTanks(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    fuelTypeId?: string | null
    activeOnly?: boolean
    search?: string | null
  }
) {
  assertFuelAnywhere(params.roles, "read")
  const where: Prisma.FuelTankWhereInput = {
    companyId: params.companyId,
    deletedAt: null,
    branchId: fuelBranchWhere(params.roles, "read", params.branchId),
  }
  if (params.fuelTypeId && z.string().uuid().safeParse(params.fuelTypeId).success) {
    where.fuelTypeId = params.fuelTypeId
  }
  if (params.activeOnly) where.isActive = true
  const q = params.search?.trim()
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ]
  }
  const rows = await db.fuelTank.findMany({
    where,
    include: fuelTankInclude,
    orderBy: [{ branch: { name: "asc" } }, { code: "asc" }],
  })
  return { data: rows.map(serializeFuelTank) }
}

export async function getFuelTank(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  assertFuelAnywhere(params.roles, "read")
  const row = await db.fuelTank.findFirst({
    where: {
      id: params.id,
      companyId: params.companyId,
      deletedAt: null,
      branchId: fuelBranchWhere(params.roles, "read"),
    },
    include: fuelTankInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบถังน้ำมัน")
  return { data: serializeFuelTank(row) }
}

export async function createFuelTank(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CreateFuelTankInput }
) {
  const input = parseOrThrow(createFuelTankSchema, params.input)
  assertFuelInBranch(params.roles, input.branchId, "create")
  await assertBranch(db, params.companyId, input.branchId)
  await assertFuelType(db, params.companyId, input.fuelTypeId)
  const minLevel = input.minLevel ?? 0
  if (minLevel > input.capacity) throw new ValidationError("ระดับแจ้งเตือนต้องไม่เกินความจุ")
  try {
    const row = await db.fuelTank.create({
      data: {
        companyId: params.companyId,
        branchId: input.branchId,
        fuelTypeId: input.fuelTypeId,
        code: input.code.toUpperCase(),
        name: input.name,
        capacity: input.capacity,
        minLevel,
        isActive: input.isActive ?? true,
      },
      include: fuelTankInclude,
    })
    return { data: serializeFuelTank(row) }
  } catch (error) {
    if (isUniqueError(error)) throw new ValidationError("รหัสถังนี้มีอยู่แล้วในบริษัท")
    throw error
  }
}

export async function updateFuelTank(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: UpdateFuelTankInput }
) {
  const input = parseOrThrow(updateFuelTankSchema, params.input)
  const existing = await db.fuelTank.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    select: {
      id: true,
      branchId: true,
      fuelTypeId: true,
      capacity: true,
      minLevel: true,
      currentQty: true,
      _count: { select: { transactions: true } },
    },
  })
  if (!existing) throw new NotFoundError("ไม่พบถังน้ำมัน")
  assertFuelInBranch(params.roles, existing.branchId, "update")

  const hasLedger = existing._count.transactions > 0
  if (input.branchId && input.branchId !== existing.branchId) {
    if (hasLedger) throw new ValidationError("ถังที่มีรายการเคลื่อนไหวแล้วย้ายสาขาไม่ได้")
    assertFuelInBranch(params.roles, input.branchId, "update")
    await assertBranch(db, params.companyId, input.branchId)
  }
  if (input.fuelTypeId && input.fuelTypeId !== existing.fuelTypeId) {
    if (hasLedger) throw new ValidationError("ถังที่มีรายการเคลื่อนไหวแล้วเปลี่ยนชนิดน้ำมันไม่ได้")
    await assertFuelType(db, params.companyId, input.fuelTypeId, existing.fuelTypeId)
  }
  const capacity = input.capacity ?? toNumber(existing.capacity)
  const minLevel = input.minLevel ?? toNumber(existing.minLevel)
  if (capacity < toNumber(existing.currentQty)) {
    throw new ValidationError("ความจุต้องไม่น้อยกว่าปริมาณคงเหลือในถัง")
  }
  if (minLevel > capacity) throw new ValidationError("ระดับแจ้งเตือนต้องไม่เกินความจุ")

  const data: Prisma.FuelTankUpdateInput = {}
  if (input.branchId) data.branch = { connect: { id: input.branchId } }
  if (input.fuelTypeId) data.fuelType = { connect: { id: input.fuelTypeId } }
  if (input.code !== undefined) data.code = input.code.toUpperCase()
  if (input.name !== undefined) data.name = input.name
  if (input.capacity !== undefined) data.capacity = input.capacity
  if (input.minLevel !== undefined) data.minLevel = input.minLevel
  if (input.isActive !== undefined) data.isActive = input.isActive
  try {
    const row = await db.fuelTank.update({ where: { id: params.id }, data, include: fuelTankInclude })
    return { data: serializeFuelTank(row) }
  } catch (error) {
    if (isUniqueError(error)) throw new ValidationError("รหัสถังนี้มีอยู่แล้วในบริษัท")
    throw error
  }
}

export async function deleteFuelTank(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const existing = await db.fuelTank.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    select: { id: true, branchId: true, currentQty: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบถังน้ำมัน")
  assertFuelInBranch(params.roles, existing.branchId, "delete")
  if (toNumber(existing.currentQty) > 0) {
    throw new ValidationError("ถังยังมีน้ำมันคงเหลือ ให้ปรับยอดเป็น 0 ก่อนลบ")
  }
  await db.fuelTank.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), isActive: false },
  })
  return { success: true }
}

/** Branches where the user may use fuel for the given action. */
export async function listFuelBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; action?: "read" | "create" }
) {
  const action = params.action ?? "read"
  assertFuelAnywhere(params.roles, action)
  const scope = fuelBranchScope(params.roles, action)
  const branches = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(scope ? { id: { in: scope.length ? scope : ["00000000-0000-0000-0000-000000000000"] } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: branches }
}
