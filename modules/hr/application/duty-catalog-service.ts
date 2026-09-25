import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { canReadPositions, type PositionAuditMeta } from "./position-service"
import { parseDutyImport } from "./duty-groups"

export type DutyCatalogItem = {
  id: string
  categoryId: string
  name: string
  sortOrder: number
  isActive: boolean
  positionCount: number
  seatCount: number
}

export type DutyCatalogCategory = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
  items: DutyCatalogItem[]
}

export type DutyImportPreview = {
  newCategories: string[]
  newItems: { category: string; name: string }[]
  skipped: number
}

type DutyAuditEvent =
  | "DUTY_CATEGORY_CREATE"
  | "DUTY_CATEGORY_UPDATE"
  | "DUTY_CATEGORY_DELETE"
  | "DUTY_ITEM_CREATE"
  | "DUTY_ITEM_UPDATE"
  | "DUTY_ITEM_DELETE"
  | "DUTY_IMPORT"

const nameSchema = (max: number) => z.string().trim().min(1).max(max)
const moveSchema = z.enum(["up", "down"]).optional()

export const createDutyCategorySchema = z.object({ name: nameSchema(255) })
export const updateDutyCategorySchema = z.object({
  name: nameSchema(255).optional(),
  isActive: z.boolean().optional(),
  move: moveSchema,
})
export const createDutyItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: nameSchema(500),
})
export const updateDutyItemSchema = z.object({
  name: nameSchema(500).optional(),
  isActive: z.boolean().optional(),
  move: moveSchema,
})
export const importDutyCatalogSchema = z.object({
  text: z.string().max(200_000),
  confirm: z.boolean().optional(),
})

export function canReadDutyCatalog(roles: UserRole[]): boolean {
  return canReadPositions(roles)
}

/** สมุดใช้ร่วมทุกสาขา — คนที่ดูแลแค่สาขาเดียวไม่ควรแก้ประโยคที่สาขาอื่นใช้อยู่ */
export function canEditDutyCatalog(roles: UserRole[]): boolean {
  return isAdminInAnyBranch(roles)
}

function assertEdit(roles: UserRole[]) {
  if (!canEditDutyCatalog(roles)) throw new ForbiddenError("แก้สมุดหน้าที่ได้เฉพาะผู้ดูแลระบบ")
}

async function writeDutyAudit(
  db: { auditLog: { create: PrismaClient["auditLog"]["create"] } },
  params: {
    userId?: string | null
    tableName: "duty_categories" | "duty_items"
    recordId: string
    action: "create" | "update" | "delete"
    event: DutyAuditEvent
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    audit?: PositionAuditMeta
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      tableName: params.tableName,
      recordId: params.recordId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: { event: params.event, ...(params.newValues ?? {}) } as Prisma.InputJsonValue,
      ipAddress: params.audit?.ipAddress ?? null,
      userAgent: params.audit?.userAgent ?? null,
    },
  })
}

function isUniqueViolation(e: unknown) {
  return (e as { code?: string })?.code === "P2002"
}

export async function listDutyCatalog(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; includeInactive?: boolean }
): Promise<{ data: DutyCatalogCategory[] }> {
  if (!canReadDutyCatalog(params.roles)) throw new ForbiddenError()
  const activeOnly = !params.includeInactive
  const rows = await db.dutyCategory.findMany({
    where: { companyId: params.companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isActive: true,
      items: {
        where: activeOnly ? { isActive: true } : {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          categoryId: true,
          name: true,
          sortOrder: true,
          isActive: true,
          _count: { select: { positions: true, seats: true } },
        },
      },
    },
  })
  return {
    data: rows.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      items: category.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        positionCount: item._count.positions,
        seatCount: item._count.seats,
      })),
    })),
  }
}

async function nextCategoryOrder(db: PrismaClient | Prisma.TransactionClient, companyId: string) {
  const last = await db.dutyCategory.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? 0) + 10
}

async function nextItemOrder(db: PrismaClient | Prisma.TransactionClient, categoryId: string) {
  const last = await db.dutyItem.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? 0) + 10
}

/** เรียงพี่น้องใหม่เป็น 10, 20, 30 แล้วสลับกับตัวข้างเคียง — ลำดับเดิมอาจซ้ำกันได้ */
function reorder<T extends { id: string }>(siblings: T[], id: string, move: "up" | "down") {
  const index = siblings.findIndex((row) => row.id === id)
  const target = move === "up" ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= siblings.length) return null
  const next = [...siblings]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  return next.map((row, i) => ({ id: row.id, sortOrder: (i + 1) * 10 }))
}

async function findCategory(db: PrismaClient, companyId: string, id: string) {
  const row = await db.dutyCategory.findFirst({
    where: { id, companyId },
    select: { id: true, name: true, isActive: true, sortOrder: true },
  })
  if (!row) throw new NotFoundError("ไม่พบหมวดหน้าที่")
  return row
}

async function findItem(db: PrismaClient, companyId: string, id: string) {
  const row = await db.dutyItem.findFirst({
    where: { id, category: { companyId } },
    select: { id: true, name: true, isActive: true, categoryId: true },
  })
  if (!row) throw new NotFoundError("ไม่พบรายการหน้าที่")
  return row
}

export async function createDutyCategory(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    input: z.infer<typeof createDutyCategorySchema>
    audit?: PositionAuditMeta
  }
) {
  assertEdit(params.roles)
  try {
    const row = await db.dutyCategory.create({
      data: {
        companyId: params.companyId,
        name: params.input.name,
        sortOrder: await nextCategoryOrder(db, params.companyId),
      },
      select: { id: true, name: true },
    })
    await writeDutyAudit(db, {
      userId: params.userId,
      tableName: "duty_categories",
      recordId: row.id,
      action: "create",
      event: "DUTY_CATEGORY_CREATE",
      newValues: { name: row.name },
      audit: params.audit,
    })
    return { data: row }
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("มีหมวดชื่อนี้แล้ว")
    throw e
  }
}

export async function updateDutyCategory(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    id: string
    input: z.infer<typeof updateDutyCategorySchema>
    audit?: PositionAuditMeta
  }
) {
  assertEdit(params.roles)
  const existing = await findCategory(db, params.companyId, params.id)
  const { input } = params

  if (input.move) {
    const siblings = await db.dutyCategory.findMany({
      where: { companyId: params.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    })
    const order = reorder(siblings, existing.id, input.move)
    if (order) {
      await db.$transaction(
        order.map((row) => db.dutyCategory.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } }))
      )
    }
  }

  const data: Prisma.DutyCategoryUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (Object.keys(data).length === 0) return { data: { id: existing.id } }

  try {
    const row = await db.dutyCategory.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, isActive: true },
    })
    await writeDutyAudit(db, {
      userId: params.userId,
      tableName: "duty_categories",
      recordId: row.id,
      action: "update",
      event: "DUTY_CATEGORY_UPDATE",
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: row.name, isActive: row.isActive },
      audit: params.audit,
    })
    return { data: { id: row.id } }
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("มีหมวดชื่อนี้แล้ว")
    throw e
  }
}

export async function deleteDutyCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId?: string | null; id: string; audit?: PositionAuditMeta }
) {
  assertEdit(params.roles)
  const existing = await findCategory(db, params.companyId, params.id)
  const itemCount = await db.dutyItem.count({ where: { categoryId: existing.id } })
  if (itemCount > 0) throw new ValidationError("หมวดนี้ยังมีรายการ ลบรายการก่อนหรือปิดใช้งานหมวดแทน")
  await db.dutyCategory.delete({ where: { id: existing.id } })
  await writeDutyAudit(db, {
    userId: params.userId,
    tableName: "duty_categories",
    recordId: existing.id,
    action: "delete",
    event: "DUTY_CATEGORY_DELETE",
    oldValues: { name: existing.name },
    audit: params.audit,
  })
  return { data: { id: existing.id } }
}

export async function createDutyItem(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    input: z.infer<typeof createDutyItemSchema>
    audit?: PositionAuditMeta
  }
) {
  assertEdit(params.roles)
  const category = await findCategory(db, params.companyId, params.input.categoryId)
  try {
    const row = await db.dutyItem.create({
      data: {
        categoryId: category.id,
        name: params.input.name,
        sortOrder: await nextItemOrder(db, category.id),
      },
      select: { id: true, name: true },
    })
    await writeDutyAudit(db, {
      userId: params.userId,
      tableName: "duty_items",
      recordId: row.id,
      action: "create",
      event: "DUTY_ITEM_CREATE",
      newValues: { name: row.name, category: category.name },
      audit: params.audit,
    })
    return { data: row }
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("หมวดนี้มีรายการชื่อนี้แล้ว")
    throw e
  }
}

export async function updateDutyItem(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    id: string
    input: z.infer<typeof updateDutyItemSchema>
    audit?: PositionAuditMeta
  }
) {
  assertEdit(params.roles)
  const existing = await findItem(db, params.companyId, params.id)
  const { input } = params

  if (input.move) {
    const siblings = await db.dutyItem.findMany({
      where: { categoryId: existing.categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    })
    const order = reorder(siblings, existing.id, input.move)
    if (order) {
      await db.$transaction(
        order.map((row) => db.dutyItem.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } }))
      )
    }
  }

  const data: Prisma.DutyItemUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (Object.keys(data).length === 0) return { data: { id: existing.id } }

  try {
    const row = await db.dutyItem.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, isActive: true },
    })
    await writeDutyAudit(db, {
      userId: params.userId,
      tableName: "duty_items",
      recordId: row.id,
      action: "update",
      event: "DUTY_ITEM_UPDATE",
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { name: row.name, isActive: row.isActive },
      audit: params.audit,
    })
    return { data: { id: row.id } }
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("หมวดนี้มีรายการชื่อนี้แล้ว")
    throw e
  }
}

export async function deleteDutyItem(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId?: string | null; id: string; audit?: PositionAuditMeta }
) {
  assertEdit(params.roles)
  const existing = await findItem(db, params.companyId, params.id)
  const [positionCount, seatCount] = await Promise.all([
    db.positionDutyItem.count({ where: { dutyItemId: existing.id } }),
    db.personnelPositionDutyItem.count({ where: { dutyItemId: existing.id } }),
  ])
  if (positionCount > 0 || seatCount > 0) {
    throw new ValidationError("ยังมีตำแหน่งหรือบุคลากรใช้รายการนี้อยู่ ให้ปิดใช้งานแทน")
  }
  await db.dutyItem.delete({ where: { id: existing.id } })
  await writeDutyAudit(db, {
    userId: params.userId,
    tableName: "duty_items",
    recordId: existing.id,
    action: "delete",
    event: "DUTY_ITEM_DELETE",
    oldValues: { name: existing.name },
    audit: params.audit,
  })
  return { data: { id: existing.id } }
}

async function planImport(db: PrismaClient, companyId: string, text: string) {
  const rows = parseDutyImport(text)
  const existing = await db.dutyCategory.findMany({
    where: { companyId },
    select: { id: true, name: true, items: { select: { name: true } } },
  })
  const categoryByName = new Map(existing.map((c) => [c.name, c]))
  const itemKeys = new Set(existing.flatMap((c) => c.items.map((item) => `${c.name}\u0000${item.name}`)))

  const newCategories: string[] = []
  const newItems: { category: string; name: string }[] = []
  let skipped = 0
  for (const row of rows) {
    if (row.category.length > 255) throw new ValidationError(`ชื่อหมวดยาวเกิน 255 ตัวอักษร: ${row.category.slice(0, 40)}`)
    if (!categoryByName.has(row.category) && !newCategories.includes(row.category)) {
      newCategories.push(row.category)
    }
    if (!row.item) continue
    if (row.item.length > 500) throw new ValidationError(`รายการยาวเกิน 500 ตัวอักษร: ${row.item.slice(0, 40)}`)
    const key = `${row.category}\u0000${row.item}`
    if (itemKeys.has(key)) {
      skipped += 1
      continue
    }
    itemKeys.add(key)
    newItems.push({ category: row.category, name: row.item })
  }
  return { categoryByName, preview: { newCategories, newItems, skipped } satisfies DutyImportPreview }
}

/** ไม่ส่ง confirm ได้แค่สรุป — ต้องให้คนตรวจก่อนว่าหมวดกับรายการแยกถูกคอลัมน์ */
export async function importDutyCatalog(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    input: z.infer<typeof importDutyCatalogSchema>
    audit?: PositionAuditMeta
  }
): Promise<{ data: DutyImportPreview & { applied: boolean } }> {
  assertEdit(params.roles)
  const { categoryByName, preview } = await planImport(db, params.companyId, params.input.text)
  if (!params.input.confirm) return { data: { ...preview, applied: false } }
  if (preview.newCategories.length === 0 && preview.newItems.length === 0) {
    return { data: { ...preview, applied: true } }
  }

  await db.$transaction(async (tx) => {
    const idByName = new Map([...categoryByName].map(([name, row]) => [name, row.id]))
    let categoryOrder = await nextCategoryOrder(tx, params.companyId)
    for (const name of preview.newCategories) {
      const row = await tx.dutyCategory.create({
        data: { companyId: params.companyId, name, sortOrder: categoryOrder },
        select: { id: true },
      })
      categoryOrder += 10
      idByName.set(name, row.id)
    }
    const orderByCategory = new Map<string, number>()
    for (const item of preview.newItems) {
      const categoryId = idByName.get(item.category)!
      let order = orderByCategory.get(categoryId)
      if (order === undefined) order = await nextItemOrder(tx, categoryId)
      await tx.dutyItem.create({ data: { categoryId, name: item.name, sortOrder: order } })
      orderByCategory.set(categoryId, order + 10)
    }
    await writeDutyAudit(tx, {
      userId: params.userId,
      tableName: "duty_categories",
      recordId: params.companyId,
      action: "create",
      event: "DUTY_IMPORT",
      newValues: {
        categories: preview.newCategories.length,
        items: preview.newItems.length,
        skipped: preview.skipped,
      },
      audit: params.audit,
    })
  })

  return { data: { ...preview, applied: true } }
}