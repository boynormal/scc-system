import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { hasPermission, type UserRole } from "@/lib/permissions"

export const createMachineImageSchema = z.object({
  fileUrl: z.string().min(1),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  isPrimary: z.boolean().default(false),
})

export const createMachineProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  order: z.number().int().default(0),
})

export const updateMachineProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  order: z.number().int().optional(),
})

export const createMachineSparePartSchema = z.object({
  partId: z.string().uuid(),
  sortOrder: z.number().int().optional(),
  qtyRecommended: z.number().int().min(1).optional(),
  note: z.string().optional(),
  installPhotoUrl: z.string().optional().nullable(),
  locationOnMachine: z.string().optional().nullable(),
})

export const updateMachineSparePartSchema = z.object({
  sortOrder: z.number().int().optional(),
  qtyRecommended: z.number().int().min(1).optional(),
  note: z.string().nullable().optional(),
  installPhotoUrl: z.string().nullable().optional(),
  locationOnMachine: z.string().nullable().optional(),
})

export async function listMachineImages(db: PrismaClient, params: { machineId: string; companyId: string }) {
  return db.machineImage.findMany({
    where: {
      machineId: params.machineId,
      machine: { branch: { companyId: params.companyId } },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  })
}

export async function createMachineImage(
  db: PrismaClient,
  params: { machineId: string; companyId: string; userId: string; input: z.infer<typeof createMachineImageSchema> }
) {
  const machine = await db.machine.findFirst({
    where: { id: params.machineId, branch: { companyId: params.companyId } },
  })
  if (!machine) return { error: "Machine not found" as const, status: 404 as const }

  if (params.input.isPrimary) {
    await db.machineImage.updateMany({
      where: { machineId: params.machineId, isPrimary: true },
      data: { isPrimary: false },
    })
  }

  const data = await db.machineImage.create({
    data: {
      machineId: params.machineId,
      fileUrl: params.input.fileUrl,
      fileName: params.input.fileName,
      fileSize: params.input.fileSize,
      isPrimary: params.input.isPrimary,
      uploadedBy: params.userId,
    },
  })

  return { data }
}

export async function updateMachineImagePrimary(
  db: PrismaClient,
  params: { machineId: string; imageId: string; companyId: string; isPrimary: boolean }
) {
  const image = await db.machineImage.findFirst({
    where: {
      id: params.imageId,
      machineId: params.machineId,
      machine: { branch: { companyId: params.companyId } },
    },
  })
  if (!image) return { error: "Image not found" as const, status: 404 as const }

  if (params.isPrimary) {
    await db.machineImage.updateMany({ where: { machineId: params.machineId }, data: { isPrimary: false } })
  }
  const data = await db.machineImage.update({
    where: { id: params.imageId },
    data: { isPrimary: params.isPrimary },
  })

  return { data }
}

export async function deleteMachineImage(
  db: PrismaClient,
  params: { machineId: string; imageId: string; companyId: string }
) {
  const image = await db.machineImage.findFirst({
    where: {
      id: params.imageId,
      machineId: params.machineId,
      machine: { branch: { companyId: params.companyId } },
    },
  })
  if (!image) return { error: "Image not found" as const, status: 404 as const }

  await db.machineImage.delete({ where: { id: params.imageId } })
  return { success: true, fileUrl: image.fileUrl }
}

export async function listMachineProducts(db: PrismaClient, params: { machineId: string; companyId: string }) {
  const rows = await db.$queryRaw<any[]>`
    SELECT p.* FROM machine_products p
    JOIN machines m ON p.machine_id = m.id
    JOIN branches b ON m.branch_id = b.id
    WHERE p.machine_id = ${params.machineId}::uuid
    AND b.company_id = ${params.companyId}::uuid
    ORDER BY p."order" ASC
  `

  return rows.map(mapMachineProduct)
}

export async function createMachineProduct(
  db: PrismaClient,
  params: { machineId: string; companyId: string; input: z.infer<typeof createMachineProductSchema> }
) {
  const machine = await db.machine.findFirst({
    where: { id: params.machineId, branch: { companyId: params.companyId }, deletedAt: null },
  })
  if (!machine) return { error: "Machine not found" as const, status: 404 as const }

  const { name, description, imageUrl, order } = params.input
  const products = await db.$queryRaw`
    INSERT INTO machine_products (id, machine_id, name, description, image_url, "order", created_at, updated_at)
    VALUES (gen_random_uuid(), ${params.machineId}::uuid, ${name}, ${description ?? null}, ${imageUrl ?? null}, ${order}, now(), now())
    RETURNING *
  `
  const raw = Array.isArray(products) ? products[0] : products

  return { data: raw ? mapMachineProduct(raw) : null }
}

export async function updateMachineProduct(
  db: PrismaClient,
  params: {
    machineId: string
    productId: string
    companyId: string
    input: z.infer<typeof updateMachineProductSchema>
  }
) {
  const ok = await machineProductInCompany(db, params)
  if (!ok) return { error: "Not found" as const, status: 404 as const }

  const values: unknown[] = []
  const parts: string[] = []
  let idx = 1

  if (params.input.name !== undefined) {
    parts.push(`name = $${idx++}`)
    values.push(params.input.name)
  }
  if (params.input.description !== undefined) {
    parts.push(`description = $${idx++}`)
    values.push(params.input.description)
  }
  if (params.input.imageUrl !== undefined) {
    parts.push(`image_url = $${idx++}`)
    values.push(params.input.imageUrl)
  }
  if (params.input.order !== undefined) {
    parts.push(`"order" = $${idx++}`)
    values.push(params.input.order)
  }
  parts.push("updated_at = now()")

  if (parts.length === 1) return { success: true }

  values.push(params.productId)
  const sql = `UPDATE machine_products SET ${parts.join(", ")} WHERE id = $${idx}::uuid RETURNING *`
  const rows = await db.$queryRawUnsafe<any[]>(sql, ...values)
  const raw = rows[0]

  return { data: raw ? mapMachineProduct(raw) : null }
}

export async function deleteMachineProduct(
  db: PrismaClient,
  params: { machineId: string; productId: string; companyId: string }
) {
  const ok = await machineProductInCompany(db, params)
  if (!ok) return { error: "Not found" as const, status: 404 as const }

  await db.$executeRaw`DELETE FROM machine_products WHERE id = ${params.productId}::uuid`
  return { success: true }
}

export async function listMachineSpareParts(db: PrismaClient, params: { machineId: string; companyId: string }) {
  const machine = await getMachineForParts(db, params)
  if (!machine) return { error: "Not found" as const, status: 404 as const }

  const rows = await db.machineSparePart.findMany({
    where: { machineId: params.machineId },
    include: machineSparePartInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  return { data: rows.map(mapMachineSparePart) }
}

export async function createMachineSparePart(
  db: PrismaClient,
  params: {
    machineId: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof createMachineSparePartSchema>
  }
) {
  const machine = await getMachineForParts(db, params)
  if (!machine) return { error: "Not found" as const, status: 404 as const }
  if (!hasPermission(params.roles, machine.branchId, "machines", "update")) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const part = await db.sparePart.findFirst({
    where: { id: params.input.partId, companyId: params.companyId, isActive: true },
    select: { id: true },
  })
  if (!part) return { error: "Spare part not found" as const, status: 404 as const }

  let sortOrder = params.input.sortOrder
  if (sortOrder === undefined) {
    const agg = await db.machineSparePart.aggregate({
      where: { machineId: params.machineId },
      _max: { sortOrder: true },
    })
    sortOrder = (agg._max.sortOrder ?? -1) + 1
  }

  try {
    const row = await db.machineSparePart.create({
      data: {
        machineId: params.machineId,
        partId: params.input.partId,
        sortOrder,
        qtyRecommended: params.input.qtyRecommended ?? 1,
        note: params.input.note ?? null,
        installPhotoUrl: params.input.installPhotoUrl ?? null,
        locationOnMachine: params.input.locationOnMachine ?? null,
      },
      include: machineSparePartInclude,
    })

    return { data: mapMachineSparePart(row) }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Part already linked to this machine" as const, status: 409 as const }
    }
    throw error
  }
}

export async function updateMachineSparePart(
  db: PrismaClient,
  params: {
    machineId: string
    lineId: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateMachineSparePartSchema>
  }
) {
  const line = await getMachineSparePartLine(db, params)
  if (!line) return { error: "Not found" as const, status: 404 as const }
  if (!hasPermission(params.roles, line.machine.branchId, "machines", "update")) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const updated = await db.machineSparePart.update({
    where: { id: params.lineId },
    data: {
      ...(params.input.sortOrder !== undefined && { sortOrder: params.input.sortOrder }),
      ...(params.input.qtyRecommended !== undefined && { qtyRecommended: params.input.qtyRecommended }),
      ...(params.input.note !== undefined && { note: params.input.note }),
      ...(params.input.installPhotoUrl !== undefined && { installPhotoUrl: params.input.installPhotoUrl }),
      ...(params.input.locationOnMachine !== undefined && { locationOnMachine: params.input.locationOnMachine }),
    },
    include: machineSparePartInclude,
  })

  return { data: mapMachineSparePart(updated) }
}

export async function deleteMachineSparePart(
  db: PrismaClient,
  params: { machineId: string; lineId: string; companyId: string; roles: UserRole[] }
) {
  const line = await getMachineSparePartLine(db, params)
  if (!line) return { error: "Not found" as const, status: 404 as const }
  if (!hasPermission(params.roles, line.machine.branchId, "machines", "update")) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  await db.machineSparePart.delete({ where: { id: params.lineId } })
  return { success: true }
}

const machineSparePartInclude = {
  part: {
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      imageUrl: true,
      unit: true,
      unitCost: true,
      supplier: { select: { id: true, name: true } },
    },
  },
}

async function getMachineForParts(db: PrismaClient, params: { machineId: string; companyId: string }) {
  return db.machine.findFirst({
    where: { id: params.machineId, deletedAt: null, branch: { companyId: params.companyId } },
    select: { id: true, branchId: true },
  })
}

async function getMachineSparePartLine(
  db: PrismaClient,
  params: { machineId: string; lineId: string; companyId: string }
) {
  return db.machineSparePart.findFirst({
    where: {
      id: params.lineId,
      machineId: params.machineId,
      machine: { deletedAt: null, branch: { companyId: params.companyId } },
    },
    include: {
      machine: { select: { branchId: true } },
    },
  })
}

async function machineProductInCompany(
  db: PrismaClient,
  params: { machineId: string; productId: string; companyId: string }
) {
  const rows = await db.$queryRaw<any[]>`
    SELECT p.id FROM machine_products p
    JOIN machines m ON p.machine_id = m.id
    JOIN branches b ON m.branch_id = b.id
    WHERE p.id = ${params.productId}::uuid
    AND p.machine_id = ${params.machineId}::uuid
    AND b.company_id = ${params.companyId}::uuid
    LIMIT 1
  `
  return rows.length > 0
}

function mapMachineProduct(raw: any) {
  return {
    id: raw.id,
    machineId: raw.machine_id,
    name: raw.name,
    description: raw.description,
    imageUrl: raw.image_url,
    order: raw.order,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

function mapMachineSparePart(row: any) {
  return {
    id: row.id,
    machineId: row.machineId,
    partId: row.partId,
    sortOrder: row.sortOrder,
    qtyRecommended: row.qtyRecommended,
    note: row.note,
    installPhotoUrl: row.installPhotoUrl,
    locationOnMachine: row.locationOnMachine,
    part: {
      ...row.part,
      unitCost: row.part.unitCost.toString(),
    },
  }
}
