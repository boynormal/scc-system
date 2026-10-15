import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

const DEFAULTS = [
  { name: "ยานพาหนะ", sortOrder: 0 },
  { name: "เครื่องจักร", sortOrder: 1 },
] as const

function canAssets(roles: UserRole[], action: "read" | "update"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

export const assetTypeNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export const updateAssetTypeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function ensureDefaultAssetTypes(db: PrismaClient, companyId: string) {
  const count = await db.assetRegisterType.count({ where: { companyId } })
  if (count > 0) return
  await db.assetRegisterType.createMany({
    data: DEFAULTS.map((row) => ({ companyId, name: row.name, sortOrder: row.sortOrder })),
    skipDuplicates: true,
  })
}

export async function listAssetRegisterTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  await ensureDefaultAssetTypes(db, params.companyId)
  const rows = await db.assetRegisterType.findMany({
    where: { companyId: params.companyId, ...(params.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true, sortOrder: true },
  })
  return { data: rows }
}

export async function createAssetRegisterType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; name: string }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const name = assetTypeNameSchema.parse({ name: params.name }).name
  const existing = await db.assetRegisterType.findFirst({
    where: { companyId: params.companyId, name },
    select: { id: true },
  })
  if (existing) throw new ValidationError("ประเภทนี้มีอยู่แล้ว")
  const row = await db.assetRegisterType.create({
    data: { companyId: params.companyId, name },
    select: { id: true, name: true, isActive: true, sortOrder: true },
  })
  return { data: row }
}

export async function updateAssetRegisterType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; name?: string; isActive?: boolean }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const input = updateAssetTypeSchema.parse(params)
  const current = await db.assetRegisterType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!current) throw new NotFoundError("ไม่พบรายการ")
  if (input.name) {
    const clash = await db.assetRegisterType.findFirst({
      where: { companyId: params.companyId, name: input.name, NOT: { id: params.id } },
      select: { id: true },
    })
    if (clash) throw new ValidationError("ประเภทนี้มีอยู่แล้ว")
  }
  const row = await db.assetRegisterType.update({
    where: { id: params.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: { id: true, name: true, isActive: true, sortOrder: true },
  })
  return { data: row }
}

export async function deleteAssetRegisterType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const current = await db.assetRegisterType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!current) throw new NotFoundError("ไม่พบรายการ")
  const used = await db.asset.count({ where: { typeId: params.id } })
  if (used > 0) throw new ValidationError("ประเภทนี้ถูกใช้แล้ว ให้ปิดการใช้งานแทน")
  await db.assetRegisterType.delete({ where: { id: params.id } })
  return { success: true }
}
