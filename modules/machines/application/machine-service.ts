import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

export const createMachineSchema = z.object({
  branchId: z.string().uuid(),
  departmentId: z.string().uuid().or(z.literal("")).transform((val) => (val === "" ? null : val)).nullable().optional(),
  categoryId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional(),
  warrantyExpireDate: z.string().or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional(),
  criticalLevel: z.coerce.number().int().min(1).max(4).default(1),
  locationDetail: z.string().nullable().optional(),
  machineType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pmGeneral: z.string().nullable().optional(),
  pmMajor: z.string().nullable().optional(),
  attributes: z.record(z.unknown()).optional(),
})

export const updateMachineSchema = z.object({
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().or(z.literal("")).transform((val) => (val === "" ? null : val)).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  model: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  installDate: z.string().or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional(),
  warrantyExpireDate: z.string().or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional(),
  criticalLevel: z.coerce.number().int().min(1).max(4).optional(),
  locationDetail: z.string().nullable().optional(),
  machineType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pmGeneral: z.string().nullable().optional(),
  pmMajor: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "under_maintenance", "decommissioned"]).optional(),
})

export type CreateMachineInput = z.infer<typeof createMachineSchema>
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>

export async function listMachines(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    categoryId?: string | null
    status?: string | null
    search?: string | null
    page: number
    pageSize: number
  }
) {
  const canReadMachines =
    isAdminInAnyBranch(params.roles) ||
    getBranchIds(params.roles).some((bid) => hasPermission(params.roles, bid, "machines", "read"))
  if (!canReadMachines) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const base = { deletedAt: null, branch: { companyId: params.companyId } }
  let branchFilter: { branchId: string } | { branchId: { in: string[] } } | Record<string, never> = {}

  if (isAdminInAnyBranch(params.roles)) {
    if (params.branchId) {
      const inCompany = await db.branch.findFirst({
        where: { id: params.branchId, companyId: params.companyId, deletedAt: null, isActive: true },
        select: { id: true },
      })
      if (!inCompany) return { error: "Invalid branch" as const, status: 400 as const }
      branchFilter = { branchId: params.branchId }
    }
  } else {
    const allowed = getBranchIds(params.roles)
    if (allowed.length === 0) {
      return { data: [], total: 0, page: params.page, pageSize: params.pageSize, totalPages: 0 }
    }
    if (params.branchId) {
      if (!allowed.includes(params.branchId)) return { error: "Forbidden" as const, status: 403 as const }
      branchFilter = { branchId: params.branchId }
    } else {
      branchFilter = { branchId: { in: allowed } }
    }
  }

  const where = {
    ...base,
    ...branchFilter,
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(params.status && { status: params.status as never }),
    ...(params.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" as never } },
        { code: { contains: params.search, mode: "insensitive" as never } },
        { manufacturer: { contains: params.search, mode: "insensitive" as never } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.machine.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { maintenancePlans: true, workOrders: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.machine.count({ where }),
  ])

  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

export async function createMachine(
  db: PrismaClient,
  params: { companyId: string; userId: string; roles: UserRole[]; input: CreateMachineInput }
) {
  const { branchId } = params.input
  const branchOk = await db.branch.findFirst({
    where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branchOk) return { error: "Invalid branch" as const, status: 400 as const }
  if (!hasPermission(params.roles, branchId, "machines", "create")) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const { attributes, machineType, description, pmGeneral, pmMajor, ...rest } = params.input
  const machine = await db.machine.create({
    data: {
      ...rest,
      installDate: rest.installDate ? new Date(rest.installDate) : undefined,
      warrantyExpireDate: rest.warrantyExpireDate ? new Date(rest.warrantyExpireDate) : undefined,
      createdBy: params.userId,
      attributes: attributes as any,
    },
  })

  await db.$executeRawUnsafe(
    `UPDATE machines SET machine_type = $1, description = $2, pm_general = $3, pm_major = $4 WHERE id = $5::uuid`,
    machineType ?? null,
    description ?? null,
    pmGeneral ?? null,
    pmMajor ?? null,
    machine.id
  )

  return {
    data: {
      ...machine,
      machineType: machineType ?? null,
      description: description ?? null,
      pmGeneral: pmGeneral ?? null,
      pmMajor: pmMajor ?? null,
    },
  }
}

export async function getMachineBase(db: PrismaClient, params: { id: string; companyId: string }) {
  return db.machine.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId }, deletedAt: null },
  })
}

export async function getMachineById(db: PrismaClient, params: { id: string; companyId: string }) {
  const machine = await getMachineBase(db, params)
  if (!machine) return null

  const extra = await db.$queryRaw<
    { machine_type: string | null; description: string | null; pm_general: string | null; pm_major: string | null }[]
  >`
    SELECT machine_type, description, pm_general, pm_major FROM machines WHERE id = ${params.id}::uuid LIMIT 1
  `

  return {
    ...machine,
    machineType: extra[0]?.machine_type ?? null,
    description: extra[0]?.description ?? null,
    pmGeneral: extra[0]?.pm_general ?? null,
    pmMajor: extra[0]?.pm_major ?? null,
  }
}

export async function updateMachine(
  db: PrismaClient,
  params: { id: string; companyId: string; input: UpdateMachineInput }
) {
  const machine = await getMachineBase(db, { id: params.id, companyId: params.companyId })
  if (!machine) return null

  const { installDate, warrantyExpireDate, departmentId, machineType, description, pmGeneral, pmMajor, ...rest } = params.input

  const updated = await db.machine.update({
    where: { id: params.id },
    data: {
      ...rest,
      departmentId: departmentId ?? null,
      installDate: installDate ? new Date(installDate) : installDate === null ? null : undefined,
      warrantyExpireDate: warrantyExpireDate ? new Date(warrantyExpireDate) : warrantyExpireDate === null ? null : undefined,
    },
  })

  await db.$executeRawUnsafe(
    `UPDATE machines SET machine_type=$1, description=$2, pm_general=$3, pm_major=$4 WHERE id=$5::uuid`,
    machineType ?? null,
    description ?? null,
    pmGeneral ?? null,
    pmMajor ?? null,
    params.id
  )

  return {
    ...updated,
    machineType: machineType ?? null,
    description: description ?? null,
    pmGeneral: pmGeneral ?? null,
    pmMajor: pmMajor ?? null,
  }
}

export async function deleteMachine(db: PrismaClient, params: { id: string; companyId: string }) {
  const machine = await getMachineBase(db, params)
  if (!machine) return null

  await db.machine.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
}

export async function getMachinesPageData(
  db: PrismaClient,
  params: { companyId: string; search?: string; categoryId?: string; status?: string; branchId?: string }
) {
  return db.machine.findMany({
    where: {
      deletedAt: null,
      branch: { companyId: params.companyId },
      ...(params.status && { status: params.status as never }),
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.branchId && { branchId: params.branchId }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: "insensitive" } },
          { code: { contains: params.search, mode: "insensitive" } },
          { manufacturer: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      category: { select: { name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
      _count: { select: { maintenancePlans: true, workOrders: true } },
    },
    orderBy: [{ status: "asc" }, { branch: { name: "asc" } }, { name: "asc" }],
  })
}

export async function getMachineDetailForPage(db: PrismaClient, params: { id: string; companyId: string }) {
  const machine = await db.machine.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId }, deletedAt: null },
    include: {
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      maintenancePlans: {
        where: { isActive: true },
        include: { type: { select: { name: true, code: true, color: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          type: { select: { name: true, code: true, color: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!machine) return null

  const [rawProducts, extra] = await Promise.all([
    db.$queryRaw<any[]>`
      SELECT * FROM machine_products WHERE machine_id = ${params.id}::uuid ORDER BY "order" ASC
    `,
    db.$queryRaw<{ machine_type: string | null; description: string | null; pm_general: string | null; pm_major: string | null }[]>`
      SELECT machine_type, description, pm_general, pm_major FROM machines WHERE id = ${params.id}::uuid LIMIT 1
    `,
  ])

  const products = rawProducts.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    order: r.order,
  }))

  return {
    ...machine,
    machineType: extra[0]?.machine_type ?? null,
    description: extra[0]?.description ?? null,
    pmGeneral: extra[0]?.pm_general ?? null,
    pmMajor: extra[0]?.pm_major ?? null,
    products,
  } as any
}

export async function getMachinePageFilters(db: PrismaClient, params: { companyId: string }) {
  const [categories, branches] = await Promise.all([
    db.machineCategory.findMany({ where: { companyId: params.companyId }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { companyId: params.companyId }, orderBy: { name: "asc" } }),
  ])

  return { categories, branches }
}
