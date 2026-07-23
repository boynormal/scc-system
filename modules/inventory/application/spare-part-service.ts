import type { PrismaClient } from "@prisma/client"
import { z } from "zod"

export const createSparePartSchema = z.object({
  supplierId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  unit: z.string().min(1).max(20),
  unitCost: z.number().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  leadTimeDays: z.number().int().min(0).default(0),
  attributes: z.record(z.unknown()).optional(),
})

export const updateSparePartSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  unit: z.string().min(1).max(20).optional(),
  unitCost: z.number().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type CreateSparePartInput = z.infer<typeof createSparePartSchema>
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>

export async function listSpareParts(
  db: PrismaClient,
  params: {
    companyId: string
    search?: string | null
    branchId?: string | null
    lowStock: boolean
    page: number
    pageSize: number
  }
) {
  const where = {
    companyId: params.companyId,
    isActive: true,
    ...(params.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" as never } },
        { code: { contains: params.search, mode: "insensitive" as never } },
        { description: { contains: params.search, mode: "insensitive" as never } },
      ],
    }),
  }

  const [parts, total] = await Promise.all([
    db.sparePart.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        inventory: params.branchId ? { where: { branchId: params.branchId } } : true,
      },
      orderBy: { name: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.sparePart.count({ where }),
  ])

  const data = params.lowStock
    ? parts.filter((part) => part.inventory.some((inventory) => inventory.currentStock <= part.minStock))
    : parts

  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

export async function createSparePart(
  db: PrismaClient,
  params: { companyId: string; input: CreateSparePartInput }
) {
  const { attributes, imageUrl, ...rest } = params.input
  const part = await db.sparePart.create({
    data: {
      ...rest,
      companyId: params.companyId,
      attributes: attributes as never,
    },
  })

  if (imageUrl) {
    await db.$executeRaw`
      UPDATE spare_parts SET image_url = ${imageUrl} WHERE id = ${part.id}::uuid
    `
  }

  return { ...part, imageUrl: imageUrl ?? null }
}

export async function getSparePartById(
  db: PrismaClient,
  params: { id: string; companyId: string }
) {
  const part = await db.sparePart.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: {
      supplier: { select: { id: true, name: true } },
      inventory: { include: { branch: { select: { id: true, name: true } } } },
    },
  })
  if (!part) return null

  const extra = await db.$queryRaw<{ image_url: string | null }[]>`
    SELECT image_url FROM spare_parts WHERE id = ${params.id}::uuid LIMIT 1
  `

  return { ...part, imageUrl: extra[0]?.image_url ?? null }
}

export async function updateSparePart(
  db: PrismaClient,
  params: { id: string; companyId: string; input: UpdateSparePartInput }
) {
  const part = await db.sparePart.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!part) return null

  const { imageUrl, ...restData } = params.input
  const updated = await db.sparePart.update({
    where: { id: params.id },
    data: restData as never,
  })

  if (imageUrl !== undefined) {
    await db.$executeRaw`
      UPDATE spare_parts SET image_url = ${imageUrl} WHERE id = ${params.id}::uuid
    `
  }

  return { ...updated, imageUrl: imageUrl ?? null }
}

export async function deactivateSparePart(
  db: PrismaClient,
  params: { id: string; companyId: string }
) {
  const part = await db.sparePart.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!part) return null

  await db.sparePart.update({ where: { id: params.id }, data: { isActive: false } })
  return { success: true }
}
