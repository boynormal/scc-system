import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

type MasterAction = "create" | "read" | "update" | "delete"

function canMasters(roles: UserRole[], action: MasterAction): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expense_masters", action))
  )
}

/** Income forms need the type list, so income readers may list masters too. */
function canReadForForms(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some(
      (bid) =>
        hasPermission(roles, bid, "expense_masters", "read") || hasPermission(roles, bid, "incomes", "read")
    )
  )
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "_")
}

function nextCode(count: number, prefix: string): string {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`
}

// ─── Income Categories ───────────────────────────────────────────────────────

export const incomeCategorySchema = z.object({
  code: z.string().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export type IncomeCategoryInput = z.infer<typeof incomeCategorySchema>

async function assertParentCategory(db: PrismaClient, companyId: string, id: string | null, parentId: string) {
  if (parentId === id) throw new ValidationError("ตั้งค่ารายการแม่เป็นตัวเองไม่ได้")
  const parent = await db.incomeCategory.findFirst({ where: { id: parentId, companyId }, select: { id: true } })
  if (!parent) throw new ValidationError("ไม่พบหมวดแม่")
  if (!id) return
  const visited = new Set<string>()
  let current: string | null = parentId
  while (current) {
    if (current === id) throw new ValidationError("ความสัมพันธ์รายการแม่-ลูกวนซ้ำ")
    if (visited.has(current)) break
    visited.add(current)
    const node: { parentId: string | null } | null = await db.incomeCategory.findUnique({
      where: { id: current },
      select: { parentId: true },
    })
    current = node?.parentId ?? null
  }
}

export async function listIncomeCategories(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.incomeCategory.findMany({
    where: { companyId: params.companyId, ...(params.includeInactive ? {} : { isActive: true }) },
    include: { parent: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { sequence: "asc" }, { code: "asc" }],
    take: 500,
  })
  return {
    data: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      parentId: r.parentId,
      parentName: r.parent?.name ?? null,
      sequence: r.sequence,
      isActive: r.isActive,
    })),
  }
}

export async function createIncomeCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: IncomeCategoryInput }
) {
  if (!canMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code?.trim()
    ? normalizeCode(params.input.code)
    : nextCode(await db.incomeCategory.count({ where: { companyId: params.companyId } }), "IC")
  const dup = await db.incomeCategory.findFirst({ where: { companyId: params.companyId, code }, select: { id: true } })
  if (dup) throw new ValidationError("รหัสหมวดรายรับซ้ำ")
  if (params.input.parentId) await assertParentCategory(db, params.companyId, null, params.input.parentId)
  const row = await db.incomeCategory.create({
    data: {
      companyId: params.companyId,
      code,
      name: params.input.name,
      description: params.input.description ?? null,
      parentId: params.input.parentId ?? null,
      sequence: params.input.sequence ?? 0,
      isActive: params.input.isActive ?? true,
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, parentId: row.parentId, isActive: row.isActive } }
}

export async function updateIncomeCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: Partial<IncomeCategoryInput> }
) {
  if (!canMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.incomeCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดรายรับ")
  const code = params.input.code?.trim() ? normalizeCode(params.input.code) : undefined
  if (code) {
    const dup = await db.incomeCategory.findFirst({
      where: { companyId: params.companyId, code, id: { not: params.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("รหัสหมวดรายรับซ้ำ")
  }
  if (params.input.parentId) await assertParentCategory(db, params.companyId, params.id, params.input.parentId)
  const row = await db.incomeCategory.update({
    where: { id: params.id },
    data: {
      ...(code ? { code } : {}),
      ...(params.input.name ? { name: params.input.name } : {}),
      ...(params.input.description !== undefined ? { description: params.input.description } : {}),
      ...(params.input.parentId !== undefined ? { parentId: params.input.parentId } : {}),
      ...(params.input.sequence !== undefined ? { sequence: params.input.sequence } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, parentId: row.parentId, isActive: row.isActive } }
}

export async function deleteIncomeCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.incomeCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดรายรับ")
  const [inUse, children] = await Promise.all([
    db.incomeType.count({ where: { categoryId: params.id } }),
    db.incomeCategory.count({ where: { parentId: params.id } }),
  ])
  if (inUse > 0 || children > 0) {
    await db.incomeCategory.update({ where: { id: params.id }, data: { isActive: false } })
    return { data: { id: params.id, deactivated: true } }
  }
  await db.incomeCategory.delete({ where: { id: params.id } })
  return { data: { id: params.id, deactivated: false } }
}

// ─── Income Types ────────────────────────────────────────────────────────────

export const incomeTypeSchema = z.object({
  code: z.string().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type IncomeTypeInput = z.infer<typeof incomeTypeSchema>

async function assertCategoryUsable(db: PrismaClient, companyId: string, categoryId: string) {
  const cat = await db.incomeCategory.findFirst({ where: { id: categoryId, companyId }, select: { isActive: true } })
  if (!cat) throw new ValidationError("ไม่พบหมวดรายรับ")
  if (!cat.isActive) throw new ValidationError("หมวดรายรับถูกปิดใช้งาน")
}

export async function listIncomeTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.incomeType.findMany({
    where: { companyId: params.companyId, ...(params.includeInactive ? {} : { isActive: true }) },
    include: { category: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    take: 500,
  })
  return {
    data: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      isActive: r.isActive,
    })),
  }
}

export async function createIncomeType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: IncomeTypeInput }
) {
  if (!canMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code?.trim()
    ? normalizeCode(params.input.code)
    : nextCode(await db.incomeType.count({ where: { companyId: params.companyId } }), "IT")
  const dup = await db.incomeType.findFirst({ where: { companyId: params.companyId, code }, select: { id: true } })
  if (dup) throw new ValidationError("รหัสประเภทรายรับซ้ำ")
  if (params.input.categoryId) await assertCategoryUsable(db, params.companyId, params.input.categoryId)
  const row = await db.incomeType.create({
    data: {
      companyId: params.companyId,
      code,
      name: params.input.name,
      description: params.input.description ?? null,
      categoryId: params.input.categoryId ?? null,
      isActive: params.input.isActive ?? true,
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, categoryId: row.categoryId, isActive: row.isActive } }
}

export async function updateIncomeType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: Partial<IncomeTypeInput> }
) {
  if (!canMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.incomeType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, categoryId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทรายรับ")
  const code = params.input.code?.trim() ? normalizeCode(params.input.code) : undefined
  if (code) {
    const dup = await db.incomeType.findFirst({
      where: { companyId: params.companyId, code, id: { not: params.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("รหัสประเภทรายรับซ้ำ")
  }
  if (params.input.categoryId && params.input.categoryId !== existing.categoryId) {
    await assertCategoryUsable(db, params.companyId, params.input.categoryId)
  }
  const row = await db.incomeType.update({
    where: { id: params.id },
    data: {
      ...(code ? { code } : {}),
      ...(params.input.name ? { name: params.input.name } : {}),
      ...(params.input.description !== undefined ? { description: params.input.description } : {}),
      ...(params.input.categoryId !== undefined ? { categoryId: params.input.categoryId } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, categoryId: row.categoryId, isActive: row.isActive } }
}

export async function deleteIncomeType(db: PrismaClient, params: { companyId: string; roles: UserRole[]; id: string }) {
  if (!canMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.incomeType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทรายรับ")
  const inUse = await db.incomeLine.count({ where: { incomeTypeId: params.id } })
  if (inUse > 0) {
    await db.incomeType.update({ where: { id: params.id }, data: { isActive: false } })
    return { data: { id: params.id, deactivated: true } }
  }
  await db.incomeType.delete({ where: { id: params.id } })
  return { data: { id: params.id, deactivated: false } }
}
