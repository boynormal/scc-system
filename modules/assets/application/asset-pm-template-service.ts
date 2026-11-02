import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

const NOT_FOUND = "ไม่พบรายการ"
const DUPLICATE = "ชื่อเทมเพลตนี้มีอยู่แล้ว"

const detailField = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const itemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  detail: detailField,
})

const itemListSchema = z.array(itemSchema).min(1).max(50)

export const createAssetPmTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  items: itemListSchema,
})

export const updateAssetPmTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  items: itemListSchema.optional(),
})

function canAssets(roles: UserRole[], action: "read" | "update"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  return parsed.data
}

function itemRows(items: { name: string; detail: string | null }[]) {
  return items.map((item, index) => ({
    sequence: index + 1,
    name: item.name,
    detail: item.detail,
  }))
}

const templateInclude = {
  items: { orderBy: { sequence: "asc" as const } },
}

function serialize(row: {
  id: string
  name: string
  isActive: boolean
  items: { id: string; sequence: number; name: string; detail: string | null }[]
}) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    items: row.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      name: item.name,
      detail: item.detail,
    })),
  }
}

export async function listAssetPmTemplates(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const rows = await db.assetPmTemplate.findMany({
    where: { companyId: params.companyId, ...(params.activeOnly ? { isActive: true } : {}) },
    include: templateInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })
  return { data: rows.map(serialize) }
}

export async function createAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: unknown }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const input = parseInput(createAssetPmTemplateSchema, params.input)
  const clash = await db.assetPmTemplate.findFirst({
    where: { companyId: params.companyId, name: input.name },
    select: { id: true },
  })
  if (clash) throw new ValidationError(DUPLICATE)
  const row = await db.assetPmTemplate.create({
    data: {
      companyId: params.companyId,
      name: input.name,
      items: { create: itemRows(input.items) },
    },
    include: templateInclude,
  })
  return { data: serialize(row) }
}

async function requireTemplate(db: PrismaClient, companyId: string, id: string) {
  const current = await db.assetPmTemplate.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!current) throw new NotFoundError(NOT_FOUND)
  return current
}

export async function updateAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: unknown }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const input = parseInput(updateAssetPmTemplateSchema, params.input)
  await requireTemplate(db, params.companyId, params.id)
  if (input.name) {
    const clash = await db.assetPmTemplate.findFirst({
      where: { companyId: params.companyId, name: input.name, NOT: { id: params.id } },
      select: { id: true },
    })
    if (clash) throw new ValidationError(DUPLICATE)
  }
  const row = await db.$transaction(async (tx) => {
    if (input.items) {
      await tx.assetPmTemplateItem.deleteMany({ where: { templateId: params.id } })
    }
    return tx.assetPmTemplate.update({
      where: { id: params.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.items ? { items: { create: itemRows(input.items) } } : {}),
      },
      include: templateInclude,
    })
  })
  return { data: serialize(row) }
}

export async function deleteAssetPmTemplate(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  await requireTemplate(db, params.companyId, params.id)
  await db.assetPmTemplate.delete({ where: { id: params.id } })
  return { success: true as const }
}
