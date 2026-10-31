import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { canDocumentMasters, canDocuments } from "./access"

const typeSchema = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const createTypeSchema = typeSchema
export const updateTypeSchema = typeSchema.partial()

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

export async function listTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  const canMaster = canDocumentMasters(params.roles, "read")
  const canReadDocs = canDocuments(params.roles, "read")
  if (!canMaster && !(params.activeOnly && canReadDocs)) throw new ForbiddenError()
  const rows = await db.docCenterType.findMany({
    where: { companyId: params.companyId, ...(params.activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
  })
  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
    })),
  }
}

export async function createType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createTypeSchema> }
) {
  if (!canDocumentMasters(params.roles, "create")) throw new ForbiddenError()
  const code = params.input.code.toUpperCase()
  const existing = await db.docCenterType.findFirst({
    where: { companyId: params.companyId, code },
    select: { id: true },
  })
  if (existing) throw new ValidationError("รหัสประเภทนี้มีอยู่แล้ว")
  const row = await db.docCenterType.create({
    data: {
      companyId: params.companyId,
      code,
      name: params.input.name,
      description: blankToNull(params.input.description),
      isActive: params.input.isActive ?? true,
    },
  })
  return { data: { id: row.id } }
}

export async function updateType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: z.infer<typeof updateTypeSchema> }
) {
  if (!canDocumentMasters(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.docCenterType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทเอกสาร")
  const code = params.input.code ? params.input.code.toUpperCase() : existing.code
  if (code !== existing.code) {
    const clash = await db.docCenterType.findFirst({
      where: { companyId: params.companyId, code, NOT: { id: existing.id } },
      select: { id: true },
    })
    if (clash) throw new ValidationError("รหัสประเภทนี้มีอยู่แล้ว")
  }
  await db.docCenterType.update({
    where: { id: existing.id },
    data: {
      code,
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.description !== undefined ? { description: blankToNull(params.input.description) } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
  return { data: { id: existing.id } }
}

export async function deleteType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDocumentMasters(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.docCenterType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบประเภทเอกสาร")
  const documents = await db.docCenterDocument.count({ where: { typeId: existing.id } })
  if (documents > 0) throw new ValidationError("ประเภทนี้ยังมีเอกสารอยู่")
  await db.docCenterType.delete({ where: { id: existing.id } })
  return { data: { id: existing.id } }
}
