import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import type { Action, Resource } from "@/lib/permissions"

type StoredPermission = Partial<Record<Resource, Action[]>> & { moduleAccess?: string[] | "all" }

export const createBranchSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  address: z.string().optional(),
  timezone: z.string().default("Asia/Bangkok"),
})

export const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.record(z.boolean()).optional(),
  moduleAccess: z.union([z.literal("all"), z.array(z.string())]).optional(),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.record(z.boolean()).optional(),
  moduleAccess: z.union([z.literal("all"), z.array(z.string())]).optional(),
})

/**
 * แมปจาก dot-notation ในฟอร์ม เป็น { resource: actions[] }
 * "view" → "read", "edit" → "update", "close" → "approve", "manage" → หลาย action
 */
const FORM_KEY_MAP: Record<string, { resource: Resource; actions: Action[] }> = {
  "machines.view": { resource: "machines", actions: ["read"] },
  "machines.create": { resource: "machines", actions: ["create"] },
  "machines.edit": { resource: "machines", actions: ["update"] },
  "machines.delete": { resource: "machines", actions: ["delete"] },
  "work_orders.view": { resource: "work_orders", actions: ["read"] },
  "work_orders.create": { resource: "work_orders", actions: ["create"] },
  "work_orders.edit": { resource: "work_orders", actions: ["update"] },
  "work_orders.close": { resource: "work_orders", actions: ["approve"] },
  "maintenance.view": { resource: "maintenance_plans", actions: ["read"] },
  "maintenance.create": { resource: "maintenance_plans", actions: ["create"] },
  "maintenance.edit": { resource: "maintenance_plans", actions: ["update"] },
  "spare_parts.view": { resource: "spare_parts", actions: ["read"] },
  "spare_parts.create": { resource: "spare_parts", actions: ["create"] },
  "spare_parts.edit": { resource: "spare_parts", actions: ["update"] },
  "reports.view": { resource: "reports", actions: ["read"] },
  "settings.view": { resource: "settings", actions: ["read"] },
  "settings.manage": { resource: "settings", actions: ["read", "update"] },
  "users.manage": { resource: "users", actions: ["create", "read", "update", "delete"] },
}

function normalizePermissions(
  raw: Record<string, boolean> | undefined,
  moduleAccess?: string[] | "all"
): StoredPermission {
  const out: StoredPermission = {}
  if (raw) {
    for (const [key, enabled] of Object.entries(raw)) {
      if (!enabled) continue
      const mapping = FORM_KEY_MAP[key]
      if (!mapping) continue
      const { resource, actions } = mapping
      const existing = out[resource] ?? []
      for (const action of actions) {
        if (!existing.includes(action)) existing.push(action)
      }
      out[resource] = existing
    }
  }
  if (moduleAccess !== undefined) {
    out.moduleAccess = moduleAccess
  }
  return out
}

export const createCategorySchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  branchId: z.string().uuid(),
})

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  branchId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
})

export const createMaintenanceTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  color: z.string().optional(),
})

export const updateMaintenanceTypeSchema = createMaintenanceTypeSchema.partial()

export const updateSupplierSchema = z.object({
  name: z.string().optional(),
  contactName: z.unknown().optional(),
  phone: z.unknown().optional(),
  email: z.unknown().optional(),
  address: z.unknown().optional(),
  leadTimeDays: z.unknown().optional(),
  isActive: z.boolean().optional(),
})

export async function listActiveBranches(db: PrismaClient, companyId: string) {
  return db.branch.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
}

export async function listSettingsBranches(db: PrismaClient, companyId: string) {
  return db.branch.findMany({
    where: { companyId, deletedAt: null },
    include: {
      _count: { select: { machines: true, userBranchRoles: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function createBranch(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createBranchSchema> }
) {
  return db.branch.create({
    data: { ...params.input, companyId: params.companyId },
  })
}

export async function listRoles(db: PrismaClient, companyId: string) {
  return db.role.findMany({
    where: { companyId },
    select: { id: true, name: true, isSystem: true },
    orderBy: { name: "asc" },
  })
}

export async function listSettingsRoles(db: PrismaClient, companyId: string) {
  return db.role.findMany({
    where: { companyId },
    include: { _count: { select: { userBranchRoles: true } } },
    orderBy: { name: "asc" },
  })
}

export async function getRoleById(
  db: PrismaClient,
  params: { id: string; companyId: string }
) {
  return db.role.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { _count: { select: { userBranchRoles: true } } },
  })
}

export async function createRole(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createRoleSchema> }
) {
  const { name, permissions, moduleAccess } = params.input
  const normalized = normalizePermissions(permissions, moduleAccess)
  return db.role.create({
    data: { name, companyId: params.companyId, permissions: normalized as object },
  })
}

export async function updateRole(
  db: PrismaClient,
  params: { id: string; companyId: string; input: z.infer<typeof updateRoleSchema> }
) {
  const role = await db.role.findFirst({ where: { id: params.id, companyId: params.companyId } })
  if (!role) throw new NotFoundError("Role not found")
  if (role.isSystem) throw new ForbiddenError("Cannot edit system role")
  const { name, permissions, moduleAccess } = params.input
  const normalized = normalizePermissions(permissions, moduleAccess)
  return db.role.update({
    where: { id: params.id },
    data: { name, permissions: normalized as object },
  })
}

export async function deleteRole(
  db: PrismaClient,
  params: { id: string; companyId: string }
) {
  const role = await db.role.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { _count: { select: { userBranchRoles: true } } },
  })
  if (!role) return { error: "Role not found", status: 404 as const }
  if (role.isSystem) return { error: "Cannot delete system role", status: 403 as const }
  if (role._count.userBranchRoles > 0) {
    return { error: `Cannot delete role because ${role._count.userBranchRoles} user(s) still use it`, status: 400 as const }
  }
  await db.role.delete({ where: { id: params.id } })
  return { success: true }
}

export async function listCategories(db: PrismaClient, companyId: string) {
  return db.machineCategory.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          machines: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { name: "asc" },
  })
}

export async function createCategory(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createCategorySchema> }
) {
  return db.machineCategory.create({
    data: {
      name: params.input.name,
      code: params.input.code || null,
      companyId: params.companyId,
    },
  })
}

export async function updateCategory(
  db: PrismaClient,
  params: { id: string; companyId: string; input: z.infer<typeof updateCategorySchema> }
) {
  const existing = await db.machineCategory.findFirst({ where: { id: params.id, companyId: params.companyId } })
  if (!existing) return null

  return db.machineCategory.update({
    where: { id: params.id },
    data: {
      ...(params.input.name && { name: params.input.name }),
      ...(params.input.code !== undefined && { code: params.input.code }),
    },
  })
}

export async function deleteCategory(db: PrismaClient, params: { id: string; companyId: string }) {
  const existing = await db.machineCategory.findFirst({ where: { id: params.id, companyId: params.companyId } })
  if (!existing) return { error: "Not found" as const, status: 404 as const }

  const count = await db.machine.count({
    where: { categoryId: params.id, deletedAt: null, branch: { companyId: params.companyId } },
  })
  if (count > 0) {
    return { error: { message: `Cannot delete category because ${count} machines still use it` }, status: 400 as const }
  }

  await db.machineCategory.delete({ where: { id: params.id } })
  return { success: true }
}

export async function getCategoryMachines(db: PrismaClient, params: { id: string; companyId: string }) {
  const category = await db.machineCategory.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, code: true, name: true },
  })
  if (!category) return null

  const machines = await db.machine.findMany({
    where: {
      categoryId: params.id,
      deletedAt: null,
      branch: { companyId: params.companyId },
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })

  return { category, machines }
}

export async function listDepartments(
  db: PrismaClient,
  params: { companyId: string; branchId?: string | null }
) {
  return db.department.findMany({
    where: {
      isActive: true,
      branch: { companyId: params.companyId },
      ...(params.branchId && { branchId: params.branchId }),
    },
    select: {
      id: true,
      name: true,
      code: true,
      branchId: true,
      branch: { select: { name: true } },
      _count: { select: { machines: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function createDepartment(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createDepartmentSchema> }
) {
  const branch = await db.branch.findFirst({
    where: { id: params.input.branchId, companyId: params.companyId, deletedAt: null },
    select: { id: true },
  })
  if (!branch) return { error: "Invalid branch" as const, status: 400 as const }

  const data = await db.department.create({
    data: {
      name: params.input.name,
      code: params.input.code || null,
      branchId: params.input.branchId,
      isActive: true,
    },
  })

  return { data }
}

export async function updateDepartment(
  db: PrismaClient,
  params: { id: string; companyId: string; input: z.infer<typeof updateDepartmentSchema> }
) {
  const existing = await db.department.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
  })
  if (!existing) return null

  if (params.input.branchId) {
    const branch = await db.branch.findFirst({
      where: { id: params.input.branchId, companyId: params.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!branch) return { error: "Invalid branch" as const, status: 400 as const }
  }

  const data = await db.department.update({
    where: { id: params.id },
    data: {
      ...(params.input.name && { name: params.input.name }),
      ...(params.input.code !== undefined && { code: params.input.code }),
      ...(params.input.branchId && { branchId: params.input.branchId }),
      ...(params.input.isActive !== undefined && { isActive: params.input.isActive }),
    },
  })

  return { data }
}

export async function deleteDepartment(db: PrismaClient, params: { id: string; companyId: string }) {
  const existing = await db.department.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId } },
  })
  if (!existing) return { error: "Not found" as const, status: 404 as const }

  const count = await db.machine.count({
    where: { departmentId: params.id, deletedAt: null, branch: { companyId: params.companyId } },
  })
  if (count > 0) {
    return { error: { message: `Cannot delete department because ${count} machines still use it` }, status: 400 as const }
  }

  await db.department.delete({ where: { id: params.id } })
  return { success: true }
}

export async function listMaintenanceTypes(db: PrismaClient, companyId: string) {
  return db.maintenanceType.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      _count: { select: { maintenancePlans: true, workOrders: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function createMaintenanceType(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createMaintenanceTypeSchema> }
) {
  return db.maintenanceType.create({
    data: {
      name: params.input.name,
      code: params.input.code,
      color: params.input.color || null,
      companyId: params.companyId,
    },
  })
}

export async function updateMaintenanceType(
  db: PrismaClient,
  params: { id: string; companyId: string; input: z.infer<typeof updateMaintenanceTypeSchema> }
) {
  const existing = await db.maintenanceType.findFirst({ where: { id: params.id, companyId: params.companyId } })
  if (!existing) return null

  return db.maintenanceType.update({
    where: { id: params.id },
    data: {
      ...(params.input.name && { name: params.input.name }),
      ...(params.input.code && { code: params.input.code }),
      ...(params.input.color !== undefined && { color: params.input.color }),
    },
  })
}

export async function deleteMaintenanceType(db: PrismaClient, params: { id: string; companyId: string }) {
  const existing = await db.maintenanceType.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { _count: { select: { maintenancePlans: true, workOrders: true, checklistTemplates: true } } },
  })
  if (!existing) return { error: "Not found" as const, status: 404 as const }

  if (
    existing._count.maintenancePlans > 0 ||
    existing._count.workOrders > 0 ||
    existing._count.checklistTemplates > 0
  ) {
    return { error: { message: "Cannot delete maintenance type because it is still in use" }, status: 400 as const }
  }

  await db.maintenanceType.delete({ where: { id: params.id } })
  return { success: true }
}

export async function listSuppliers(
  db: PrismaClient,
  params: { companyId: string; includeInactive: boolean }
) {
  if (params.includeInactive) {
    return db.supplier.findMany({
      where: { companyId: params.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        leadTimeDays: true,
        isActive: true,
        _count: { select: { spareParts: true } },
      },
      orderBy: { name: "asc" },
    })
  }

  return db.supplier.findMany({
    where: { companyId: params.companyId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
}

export async function createSupplier(
  db: PrismaClient,
  params: { companyId: string; input: Record<string, unknown> }
) {
  const name = typeof params.input.name === "string" ? params.input.name.trim() : ""
  if (!name) return { error: { message: "Supplier name is required" }, status: 400 as const }

  let code: string
  try {
    code = await allocateUniqueSupplierCode(db)
  } catch {
    return { error: { message: "Cannot allocate supplier code. Please try again." }, status: 503 as const }
  }

  try {
    const data = await db.supplier.create({
      data: {
        companyId: params.companyId,
        code,
        name,
        contactName: emptyToNull(params.input.contactName),
        phone: emptyToNull(params.input.phone),
        email: emptyToNull(params.input.email),
        address: emptyToNull(params.input.address),
        leadTimeDays: parseLeadTime(params.input.leadTimeDays),
        isActive: params.input.isActive === false ? false : true,
      },
    })
    return { data }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: { message: "Supplier code already exists" }, status: 409 as const }
    }
    throw error
  }
}

export async function updateSupplier(
  db: PrismaClient,
  params: { id: string; companyId: string; input: z.infer<typeof updateSupplierSchema> }
) {
  const existing = await db.supplier.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { _count: { select: { spareParts: true } } },
  })
  if (!existing) return { error: { message: "Supplier not found" }, status: 404 as const }

  const data: Prisma.SupplierUpdateInput = {}
  if (typeof params.input.name === "string") {
    const name = params.input.name.trim()
    if (!name) return { error: { message: "Name is required" }, status: 400 as const }
    data.name = name
  }
  if (params.input.contactName !== undefined) data.contactName = emptyToNull(params.input.contactName)
  if (params.input.phone !== undefined) data.phone = emptyToNull(params.input.phone)
  if (params.input.email !== undefined) data.email = emptyToNull(params.input.email)
  if (params.input.address !== undefined) data.address = emptyToNull(params.input.address)
  if (params.input.leadTimeDays !== undefined) data.leadTimeDays = parseLeadTime(params.input.leadTimeDays)
  if (typeof params.input.isActive === "boolean") data.isActive = params.input.isActive

  try {
    const updated = await db.supplier.update({
      where: { id: params.id },
      data,
    })
    return { data: updated }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: { message: "Supplier code already exists" }, status: 409 as const }
    }
    throw error
  }
}

export async function deleteSupplier(db: PrismaClient, params: { id: string; companyId: string }) {
  const existing = await db.supplier.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: { _count: { select: { spareParts: true } } },
  })
  if (!existing) return { error: { message: "Supplier not found" }, status: 404 as const }

  if (existing._count.spareParts > 0) {
    return {
      error: { message: `Cannot delete supplier because ${existing._count.spareParts} spare parts still use it` },
      status: 400 as const,
    }
  }

  await db.supplier.delete({ where: { id: params.id } })
  return { success: true }
}

export async function getSupplierSpareParts(db: PrismaClient, params: { id: string; companyId: string }) {
  const supplier = await db.supplier.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: { id: true, code: true, name: true },
  })
  if (!supplier) return null

  const parts = await db.sparePart.findMany({
    where: { supplierId: params.id, companyId: params.companyId },
    select: { id: true, code: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  })

  return { supplier, parts }
}

async function allocateUniqueSupplierCode(db: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = `S-${randomBytes(6).toString("hex").toUpperCase()}`
    const dup = await db.supplier.findUnique({
      where: { code: candidate },
      select: { id: true },
    })
    if (!dup) return candidate
  }
  throw new Error("allocateUniqueSupplierCode exhausted")
}

function emptyToNull(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text === "" ? null : text
}

function parseLeadTime(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(32767, Math.floor(parsed))
}
