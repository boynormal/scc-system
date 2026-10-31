import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { canDocumentMasters, canDocuments } from "./access"
import { parentCreatesCycle } from "./rules"

const categorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export const createCategorySchema = categorySchema
export const updateCategorySchema = categorySchema.partial()

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

async function assertParent(
  db: PrismaClient,
  companyId: string,
  categoryId: string | null,
  parentId: string | null
) {
  if (!parentId) return
  if (parentId === categoryId) throw new ValidationError("หมวดหมู่แม่ไม่ถูกต้อง")
  const rows = await db.docCenterCategory.findMany({
    where: { companyId },
    select: { id: true, parentId: true },
  })
  if (!rows.some((row) => row.id === parentId)) throw new ValidationError("ไม่พบหมวดหมู่แม่")
  if (categoryId && parentCreatesCycle(rows, categoryId, parentId)) {
    throw new ValidationError("หมวดหมู่แม่ทำให้เกิดวงวน")
  }
}

async function assertSiblingName(
  db: PrismaClient,
  companyId: string,
  parentId: string | null,
  name: string,
  excludeId?: string
) {
  const existing = await db.docCenterCategory.findFirst({
    where: {
      companyId,
      parentId,
      name,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existing) throw new ValidationError("มีหมวดหมู่ชื่อนี้อยู่แล้ว")
}

export async function listCategories(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  const canMaster = canDocumentMasters(params.roles, "read")
  const canReadDocs = canDocuments(params.roles, "read")
  if (!canMaster && !(params.activeOnly && canReadDocs)) throw new ForbiddenError()
  const rows = await db.docCenterCategory.findMany({
    where: {
      companyId: params.companyId,
      ...(params.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return {
    data: rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    })),
  }
}

export async function createCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createCategorySchema> }
) {
  if (!canDocumentMasters(params.roles, "create")) throw new ForbiddenError()
  const parentId = params.input.parentId ?? null
  await assertParent(db, params.companyId, null, parentId)
  await assertSiblingName(db, params.companyId, parentId, params.input.name)
  const row = await db.docCenterCategory.create({
    data: {
      companyId: params.companyId,
      parentId,
      code: blankToNull(params.input.code),
      name: params.input.name,
      description: blankToNull(params.input.description),
      sortOrder: params.input.sortOrder ?? 0,
      isActive: params.input.isActive ?? true,
    },
  })
  return { data: { id: row.id } }
}

export async function updateCategory(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    id: string
    input: z.infer<typeof updateCategorySchema>
  }
) {
  if (!canDocumentMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.docCenterCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดหมู่")
  const parentId = params.input.parentId === undefined ? existing.parentId : params.input.parentId
  const name = params.input.name ?? existing.name
  await assertParent(db, params.companyId, existing.id, parentId)
  await assertSiblingName(db, params.companyId, parentId, name, existing.id)
  await db.docCenterCategory.update({
    where: { id: existing.id },
    data: {
      parentId,
      name,
      ...(params.input.code !== undefined ? { code: blankToNull(params.input.code) } : {}),
      ...(params.input.description !== undefined ? { description: blankToNull(params.input.description) } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
  return { data: { id: existing.id } }
}

export async function deleteCategory(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDocumentMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.docCenterCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบหมวดหมู่")
  const [documents, children] = await Promise.all([
    db.docCenterDocument.count({ where: { categoryId: existing.id } }),
    db.docCenterCategory.count({ where: { parentId: existing.id } }),
  ])
  if (children > 0) throw new ValidationError("ย้ายหรือลบหมวดย่อยก่อน")
  if (documents > 0) throw new ValidationError("หมวดหมู่นี้ยังมีเอกสารอยู่")
  await db.docCenterCategory.delete({ where: { id: existing.id } })
  return { data: { id: existing.id } }
}