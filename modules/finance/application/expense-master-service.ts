import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

export const EXPENSE_TRANSACTION_TYPES = [
  "EXPENSE",
  "COST",
  "INCOME",
  "ASSET",
  "LIABILITY",
] as const

export const EXPENSE_COST_TYPES = ["FIXED", "VARIABLE", "MIXED"] as const
export const EXPENSE_DIRECTNESS = ["DIRECT", "INDIRECT"] as const

type MasterAction = "create" | "read" | "update" | "delete"

function canMasters(roles: UserRole[], action: MasterAction): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expense_masters", action))
  )
}

/** Reading master lists is allowed for anyone who can read expenses or incomes (needed for form dropdowns). */
function canReadForForms(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some(
      (bid) =>
        hasPermission(roles, bid, "expense_masters", "read") ||
        hasPermission(roles, bid, "expenses", "read") ||
        hasPermission(roles, bid, "incomes", "read")
    )
  )
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "_")
}

async function nextMasterCode(count: number, prefix: string): Promise<string> {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`
}

/**
 * Reject invalid hierarchy edits: a node cannot be its own parent, and a node
 * cannot be placed under one of its own descendants (which would create a cycle).
 * Walks the ancestor chain of the proposed parent; if the edited node id appears
 * among those ancestors, the parent is a descendant of the node → invalid.
 */
async function assertNoHierarchyCycle(
  db: PrismaClient,
  model: "expenseCategory",
  id: string,
  parentId: string
): Promise<void> {
  if (parentId === id) throw new ValidationError("ตั้งค่ารายการแม่เป็นตัวเองไม่ได้")
  const visited = new Set<string>()
  let current: string | null = parentId
  while (current) {
    if (current === id) throw new ValidationError("ความสัมพันธ์รายการแม่-ลูกวนซ้ำ")
    if (visited.has(current)) break
    visited.add(current)
    const node: { parentId: string | null } | null = await db[model].findUnique({
      where: { id: current },
      select: { parentId: true },
    })
    current = node?.parentId ?? null
  }
}

// ─── Mapping input helpers ─────────────────────────────────────────────────────

const costCenterMapInput = z.object({
  costCenterId: z.string().uuid(),
  isDefault: z.boolean().optional(),
  isAllowed: z.boolean().optional(),
})

type NormalizedCostCenterMap = { costCenterId: string; isDefault: boolean; isAllowed: boolean }

/** Test-only handle for the pure mapping-normalization invariants. */
export const _normalizeCostCenterMapsForTests = normalizeCostCenterMaps

/**
 * Enforce mapping invariants (constraints 4-5): isDefault ⇒ isAllowed, no
 * duplicate targets, and at most one default per expense item.
 */
function normalizeCostCenterMaps(
  input: z.infer<typeof costCenterMapInput>[]
): NormalizedCostCenterMap[] {
  const seen = new Set<string>()
  let defaults = 0
  const out: NormalizedCostCenterMap[] = []
  for (const m of input) {
    if (seen.has(m.costCenterId)) throw new ValidationError("หน่วยงานซ้ำในรายการที่อนุญาต")
    seen.add(m.costCenterId)
    const isDefault = m.isDefault ?? false
    const isAllowed = isDefault ? true : m.isAllowed ?? true
    if (isDefault) defaults += 1
    out.push({ costCenterId: m.costCenterId, isDefault, isAllowed })
  }
  if (defaults > 1) throw new ValidationError("กำหนดหน่วยงานเริ่มต้นได้เพียงรายการเดียว")
  return out
}

async function assertActiveCostCenters(
  db: PrismaClient,
  companyId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const found = await db.costCenter.count({
    where: { companyId, isActive: true, id: { in: ids } },
  })
  if (found !== ids.length) throw new ValidationError("มีหน่วยงานที่ไม่ถูกต้องหรือถูกปิดใช้งาน")
}

async function assertCategoryValid(
  db: PrismaClient,
  companyId: string,
  categoryId: string
): Promise<void> {
  const cat = await db.expenseCategory.findFirst({
    where: { id: categoryId, companyId },
    select: { isActive: true },
  })
  if (!cat) throw new ValidationError("ไม่พบหมวดค่าใช้จ่าย")
  if (!cat.isActive) throw new ValidationError("หมวดค่าใช้จ่ายถูกปิดใช้งาน")
}

// ─── Expense Types (Expense Items) ─────────────────────────────────────────────

export const expenseTypeSchema = z.object({
  code: z.string().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  subcategory: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  transactionType: z.enum(EXPENSE_TRANSACTION_TYPES).optional(),
  defaultCostType: z.enum(EXPENSE_COST_TYPES).nullable().optional(),
  defaultDirectness: z.enum(EXPENSE_DIRECTNESS).nullable().optional(),
  defaultGlLabel: z.string().trim().max(255).nullable().optional(),
  requiresVendor: z.boolean().optional(),
  requiresVehicle: z.boolean().optional(),
  requiresMachine: z.boolean().optional(),
  requiresLocation: z.boolean().optional(),
  requiresCostCenter: z.boolean().optional(),
  costCenters: z.array(costCenterMapInput).optional(),
  isActive: z.boolean().optional(),
})

export type ExpenseTypeInput = z.infer<typeof expenseTypeSchema>

function serializeExpenseType(r: {
  id: string
  code: string
  name: string
  subcategory: string | null
  description: string | null
  categoryId: string | null
  category?: { name: string } | null
  transactionType: string
  defaultCostType: string | null
  defaultDirectness: string | null
  defaultGlLabel: string | null
  requiresVendor: boolean
  requiresVehicle: boolean
  requiresMachine: boolean
  requiresLocation: boolean
  requiresCostCenter: boolean
  isActive: boolean
  _count?: { costCenterMaps: number }
  costCenterMaps?: Array<{ costCenterId: string; isDefault: boolean; isAllowed: boolean }>
}) {
  const ccMaps = r.costCenterMaps ?? []
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    subcategory: r.subcategory,
    description: r.description,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    transactionType: r.transactionType,
    defaultCostType: r.defaultCostType,
    defaultDirectness: r.defaultDirectness,
    defaultGlLabel: r.defaultGlLabel,
    requiresVendor: r.requiresVendor,
    requiresVehicle: r.requiresVehicle,
    requiresMachine: r.requiresMachine,
    requiresLocation: r.requiresLocation,
    requiresCostCenter: r.requiresCostCenter,
    isActive: r.isActive,
    costCenterCount: r._count?.costCenterMaps ?? ccMaps.length,
    allowedCostCenterIds: ccMaps.filter((m) => m.isAllowed).map((m) => m.costCenterId),
    defaultCostCenterId: ccMaps.find((m) => m.isDefault)?.costCenterId ?? null,
  }
}

export async function listExpenseTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.expenseType.findMany({
    where: {
      companyId: params.companyId,
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    include: {
      category: { select: { name: true } },
      _count: { select: { costCenterMaps: true } },
      costCenterMaps: { select: { costCenterId: true, isDefault: true, isAllowed: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 500,
  })
  return { data: rows.map(serializeExpenseType) }
}

/** Allowed/default cost centers for one expense item (used by the mapping GET endpoint + detail view). */
export async function getExpenseTypeCostCenters(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.expenseTypeCostCenter.findMany({
    where: { expenseTypeId: params.id, companyId: params.companyId },
    include: { costCenter: { select: { code: true, name: true, isActive: true } } },
    orderBy: [{ isDefault: "desc" }],
  })
  return {
    data: rows.map((r) => ({
      targetId: r.costCenterId,
      code: r.costCenter.code,
      name: r.costCenter.name,
      isActive: r.costCenter.isActive,
      isDefault: r.isDefault,
      isAllowed: r.isAllowed,
    })),
  }
}

export async function createExpenseType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: ExpenseTypeInput }
) {
  if (!canMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code?.trim()
    ? normalizeCode(params.input.code)
    : await nextMasterCode(
        await db.expenseType.count({ where: { companyId: params.companyId } }),
        "ET"
      )
  const dup = await db.expenseType.findFirst({
    where: { companyId: params.companyId, code },
    select: { id: true },
  })
  if (dup) throw new ValidationError("รหัสประเภทค่าใช้จ่ายซ้ำ")

  if (params.input.categoryId) await assertCategoryValid(db, params.companyId, params.input.categoryId)

  const ccMaps = params.input.costCenters ? normalizeCostCenterMaps(params.input.costCenters) : []
  await assertActiveCostCenters(db, params.companyId, ccMaps.map((m) => m.costCenterId))

  const row = await db.$transaction(async (tx) => {
    const created = await tx.expenseType.create({
      data: {
        companyId: params.companyId,
        code,
        name: params.input.name,
        subcategory: params.input.subcategory ?? null,
        description: params.input.description ?? null,
        categoryId: params.input.categoryId ?? null,
        transactionType: params.input.transactionType ?? "EXPENSE",
        defaultCostType: params.input.defaultCostType ?? null,
        defaultDirectness: params.input.defaultDirectness ?? null,
        defaultGlLabel: params.input.defaultGlLabel ?? null,
        requiresVendor: params.input.requiresVendor ?? false,
        requiresVehicle: params.input.requiresVehicle ?? false,
        requiresMachine: params.input.requiresMachine ?? false,
        requiresLocation: params.input.requiresLocation ?? false,
        requiresCostCenter: params.input.requiresCostCenter ?? false,
        isActive: params.input.isActive ?? true,
      },
      include: {
        category: { select: { name: true } },
        _count: { select: { costCenterMaps: true } },
      },
    })
    if (ccMaps.length) {
      await tx.expenseTypeCostCenter.createMany({
        data: ccMaps.map((m) => ({
          companyId: params.companyId,
          expenseTypeId: created.id,
          costCenterId: m.costCenterId,
          isDefault: m.isDefault,
          isAllowed: m.isAllowed,
        })),
      })
    }
    return created
  })
  return { data: serializeExpenseType(row) }
}

export async function updateExpenseType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: Partial<ExpenseTypeInput> }
) {
  if (!canMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.expenseType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทค่าใช้จ่าย")

  const code = params.input.code?.trim() ? normalizeCode(params.input.code) : undefined
  if (code) {
    const dup = await db.expenseType.findFirst({
      where: { companyId: params.companyId, code, id: { not: params.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("รหัสประเภทค่าใช้จ่ายซ้ำ")
  }

  if (params.input.categoryId) await assertCategoryValid(db, params.companyId, params.input.categoryId)

  const ccMaps = params.input.costCenters ? normalizeCostCenterMaps(params.input.costCenters) : undefined
  if (ccMaps) await assertActiveCostCenters(db, params.companyId, ccMaps.map((m) => m.costCenterId))

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.expenseType.update({
      where: { id: params.id },
      data: {
        ...(code ? { code } : {}),
        ...(params.input.name ? { name: params.input.name } : {}),
        ...(params.input.subcategory !== undefined ? { subcategory: params.input.subcategory } : {}),
        ...(params.input.description !== undefined ? { description: params.input.description } : {}),
        ...(params.input.categoryId !== undefined ? { categoryId: params.input.categoryId } : {}),
        ...(params.input.transactionType ? { transactionType: params.input.transactionType } : {}),
        ...(params.input.defaultCostType !== undefined ? { defaultCostType: params.input.defaultCostType } : {}),
        ...(params.input.defaultDirectness !== undefined ? { defaultDirectness: params.input.defaultDirectness } : {}),
        ...(params.input.defaultGlLabel !== undefined ? { defaultGlLabel: params.input.defaultGlLabel } : {}),
        ...(params.input.requiresVendor !== undefined ? { requiresVendor: params.input.requiresVendor } : {}),
        ...(params.input.requiresVehicle !== undefined ? { requiresVehicle: params.input.requiresVehicle } : {}),
        ...(params.input.requiresMachine !== undefined ? { requiresMachine: params.input.requiresMachine } : {}),
        ...(params.input.requiresLocation !== undefined ? { requiresLocation: params.input.requiresLocation } : {}),
        ...(params.input.requiresCostCenter !== undefined ? { requiresCostCenter: params.input.requiresCostCenter } : {}),
        ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
      },
      include: {
        category: { select: { name: true } },
        _count: { select: { costCenterMaps: true } },
      },
    })
    if (ccMaps) {
      await tx.expenseTypeCostCenter.deleteMany({ where: { expenseTypeId: params.id } })
      if (ccMaps.length) {
        await tx.expenseTypeCostCenter.createMany({
          data: ccMaps.map((m) => ({
            companyId: params.companyId,
            expenseTypeId: params.id,
            costCenterId: m.costCenterId,
            isDefault: m.isDefault,
            isAllowed: m.isAllowed,
          })),
        })
      }
    }
    // Re-read counts after mapping sync so the response reflects current state.
    const fresh = await tx.expenseType.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        category: { select: { name: true } },
        _count: { select: { costCenterMaps: true } },
      },
    })
    return fresh ?? updated
  })
  return { data: serializeExpenseType(row) }
}

export async function deleteExpenseType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.expenseType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทค่าใช้จ่าย")
  const inUse = await db.expenseLine.count({ where: { expenseTypeId: params.id } })
  if (inUse > 0) {
    // Never break historical transactions: deactivate instead of hard delete.
    await db.expenseType.update({ where: { id: params.id }, data: { isActive: false } })
    return { data: { id: params.id, deactivated: true } }
  }
  await db.expenseType.delete({ where: { id: params.id } })
  return { data: { id: params.id, deactivated: false } }
}

// ─── Expense Categories ────────────────────────────────────────────────────────

export const expenseCategorySchema = z.object({
  code: z.string().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>

async function assertParentCategoryInCompany(
  db: PrismaClient,
  companyId: string,
  parentId: string
): Promise<void> {
  const parent = await db.expenseCategory.findFirst({
    where: { id: parentId, companyId },
    select: { id: true },
  })
  if (!parent) throw new ValidationError("ไม่พบหมวดแม่")
}

export async function listExpenseCategories(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.expenseCategory.findMany({
    where: {
      companyId: params.companyId,
      ...(params.includeInactive ? {} : { isActive: true }),
    },
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

export async function createExpenseCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: ExpenseCategoryInput }
) {
  if (!canMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code?.trim()
    ? normalizeCode(params.input.code)
    : await nextMasterCode(
        await db.expenseCategory.count({ where: { companyId: params.companyId } }),
        "EC"
      )
  const dup = await db.expenseCategory.findFirst({
    where: { companyId: params.companyId, code },
    select: { id: true },
  })
  if (dup) throw new ValidationError("รหัสหมวดค่าใช้จ่ายซ้ำ")
  if (params.input.parentId) await assertParentCategoryInCompany(db, params.companyId, params.input.parentId)

  const row = await db.expenseCategory.create({
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
  return {
    data: { id: row.id, code: row.code, name: row.name, parentId: row.parentId, isActive: row.isActive },
  }
}

export async function updateExpenseCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: Partial<ExpenseCategoryInput> }
) {
  if (!canMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.expenseCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดค่าใช้จ่าย")

  const code = params.input.code?.trim() ? normalizeCode(params.input.code) : undefined
  if (code) {
    const dup = await db.expenseCategory.findFirst({
      where: { companyId: params.companyId, code, id: { not: params.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("รหัสหมวดค่าใช้จ่ายซ้ำ")
  }
  if (params.input.parentId) {
    await assertParentCategoryInCompany(db, params.companyId, params.input.parentId)
    await assertNoHierarchyCycle(db, "expenseCategory", params.id, params.input.parentId)
  }

  const row = await db.expenseCategory.update({
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
  return {
    data: { id: row.id, code: row.code, name: row.name, parentId: row.parentId, isActive: row.isActive },
  }
}

export async function deleteExpenseCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.expenseCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดค่าใช้จ่าย")
  const inUse = await db.expenseType.count({ where: { categoryId: params.id } })
  const hasChildren = await db.expenseCategory.count({ where: { parentId: params.id } })
  if (inUse > 0 || hasChildren > 0) {
    await db.expenseCategory.update({ where: { id: params.id }, data: { isActive: false } })
    return { data: { id: params.id, deactivated: true } }
  }
  await db.expenseCategory.delete({ where: { id: params.id } })
  return { data: { id: params.id, deactivated: false } }
}

// ─── Cost Centers ────────────────────────────────────────────────────────────

export const costCenterSchema = z.object({
  code: z.string().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  branchId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type CostCenterInput = z.infer<typeof costCenterSchema>

export async function listCostCenters(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
) {
  if (!canReadForForms(params.roles)) throw new ForbiddenError()
  const rows = await db.costCenter.findMany({
    where: {
      companyId: params.companyId,
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    include: {
      branch: { select: { id: true, name: true } },
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 500,
  })
  return {
    data: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      branchId: r.branchId,
      branchName: r.branch?.name ?? null,
      parentId: r.parentId,
      parentName: r.parent?.name ?? null,
      isActive: r.isActive,
    })),
  }
}

export async function createCostCenter(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CostCenterInput }
) {
  if (!canMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code?.trim()
    ? normalizeCode(params.input.code)
    : await nextMasterCode(
        await db.costCenter.count({ where: { companyId: params.companyId } }),
        "CC"
      )
  const dup = await db.costCenter.findFirst({
    where: { companyId: params.companyId, code },
    select: { id: true },
  })
  if (dup) throw new ValidationError("รหัสหน่วยงานซ้ำ")
  const row = await db.costCenter.create({
    data: {
      companyId: params.companyId,
      code,
      name: params.input.name,
      branchId: params.input.branchId ?? null,
      parentId: params.input.parentId ?? null,
      isActive: params.input.isActive ?? true,
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, isActive: row.isActive } }
}

export async function updateCostCenter(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: Partial<CostCenterInput> }
) {
  if (!canMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.costCenter.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหน่วยงาน")
  if (params.input.parentId && params.input.parentId === params.id) {
    throw new ValidationError("หน่วยงานเป็นแม่ของตัวเองไม่ได้")
  }
  const code = params.input.code?.trim() ? normalizeCode(params.input.code) : undefined
  if (code) {
    const dup = await db.costCenter.findFirst({
      where: { companyId: params.companyId, code, id: { not: params.id } },
      select: { id: true },
    })
    if (dup) throw new ValidationError("รหัสหน่วยงานซ้ำ")
  }
  const row = await db.costCenter.update({
    where: { id: params.id },
    data: {
      ...(code ? { code } : {}),
      ...(params.input.name ? { name: params.input.name } : {}),
      ...(params.input.branchId !== undefined ? { branchId: params.input.branchId } : {}),
      ...(params.input.parentId !== undefined ? { parentId: params.input.parentId } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
  return { data: { id: row.id, code: row.code, name: row.name, isActive: row.isActive } }
}

export async function deleteCostCenter(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.costCenter.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหน่วยงาน")
  const inUse = await db.expenseLine.count({ where: { costCenterId: params.id } })
  const hasChildren = await db.costCenter.count({ where: { parentId: params.id } })
  const inMapping = await db.expenseTypeCostCenter.count({ where: { costCenterId: params.id } })
  if (inUse > 0 || hasChildren > 0 || inMapping > 0) {
    await db.costCenter.update({ where: { id: params.id }, data: { isActive: false } })
    return { data: { id: params.id, deactivated: true } }
  }
  await db.costCenter.delete({ where: { id: params.id } })
  return { data: { id: params.id, deactivated: false } }
}
