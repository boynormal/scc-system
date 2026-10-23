import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { assertFuelAnywhere } from "./fuel-access"
import { parseOrThrow } from "./fuel-validation"

const FUEL_UNIT = "ลิตร"
const CODE_PREFIX = "FT-"
const CODE_RETRIES = 3

export const createFuelTypeSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อชนิดน้ำมัน").max(100),
  isActive: z.boolean().optional(),
})

export const updateFuelTypeSchema = createFuelTypeSchema.partial()

export type CreateFuelTypeInput = z.input<typeof createFuelTypeSchema>
export type UpdateFuelTypeInput = z.input<typeof updateFuelTypeSchema>

function isUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

const fuelTypeSelect = {
  id: true,
  code: true,
  name: true,
  unit: true,
  isActive: true,
  _count: { select: { tanks: { where: { deletedAt: null } } } },
} satisfies Prisma.FuelTypeSelect

function serialize(row: Prisma.FuelTypeGetPayload<{ select: typeof fuelTypeSelect }>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    isActive: row.isActive,
    tankCount: row._count.tanks,
  }
}

export type FuelTypeDto = ReturnType<typeof serialize>

export async function listFuelTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  assertFuelAnywhere(params.roles, "read")
  const rows = await db.fuelType.findMany({
    where: { companyId: params.companyId, ...(params.activeOnly ? { isActive: true } : {}) },
    select: fuelTypeSelect,
    orderBy: [{ code: "asc" }],
  })
  return { data: rows.map(serialize) }
}

export async function createFuelType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CreateFuelTypeInput }
) {
  assertFuelAnywhere(params.roles, "create")
  const input = parseOrThrow(createFuelTypeSchema, params.input)
  for (let attempt = 1; ; attempt++) {
    try {
      const row = await db.fuelType.create({
        data: {
          companyId: params.companyId,
          code: await nextFuelTypeCode(db, params.companyId),
          name: input.name,
          unit: FUEL_UNIT,
          isActive: input.isActive ?? true,
        },
        select: fuelTypeSelect,
      })
      return { data: serialize(row) }
    } catch (error) {
      if (isUniqueError(error) && attempt < CODE_RETRIES) continue
      if (isUniqueError(error)) throw new ValidationError("สร้างรหัสชนิดน้ำมันไม่สำเร็จ กรุณาลองใหม่")
      throw error
    }
  }
}

/** Next FT-### code for the company; seeded codes like DIESEL are ignored. */
async function nextFuelTypeCode(db: PrismaClient, companyId: string): Promise<string> {
  const rows = await db.fuelType.findMany({
    where: { companyId, code: { startsWith: CODE_PREFIX } },
    select: { code: true },
  })
  const max = rows.reduce((acc, r) => {
    const n = Number(r.code.slice(CODE_PREFIX.length))
    return Number.isInteger(n) && n > acc ? n : acc
  }, 0)
  return `${CODE_PREFIX}${String(max + 1).padStart(3, "0")}`
}

export async function updateFuelType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: UpdateFuelTypeInput }
) {
  assertFuelAnywhere(params.roles, "update")
  const input = parseOrThrow(updateFuelTypeSchema, params.input)
  const existing = await db.fuelType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบชนิดน้ำมัน")
  const data: Prisma.FuelTypeUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.isActive !== undefined) data.isActive = input.isActive
  const row = await db.fuelType.update({ where: { id: params.id }, data, select: fuelTypeSelect })
  return { data: serialize(row) }
}

export async function deleteFuelType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  assertFuelAnywhere(params.roles, "delete")
  const existing = await db.fuelType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, _count: { select: { tanks: true } } },
  })
  if (!existing) throw new NotFoundError("ไม่พบชนิดน้ำมัน")
  if (existing._count.tanks > 0) {
    throw new ValidationError("ชนิดน้ำมันนี้มีถังใช้งานอยู่ ให้ปิดใช้งานแทนการลบ")
  }
  await db.fuelType.delete({ where: { id: params.id } })
  return { success: true }
}
