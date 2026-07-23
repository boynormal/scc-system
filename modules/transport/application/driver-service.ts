import { z } from "zod"
import type { PrismaClient, Prisma } from "@prisma/client"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, getBranchIds, type UserRole } from "@/lib/permissions"
import { generateDriverCode } from "./generate-entity-code"
import { DRIVER_DRIVABLE_VEHICLE_TYPES, DRIVER_LICENSE_TYPES } from "./driver-options"

const licenseTypesSchema = z.array(z.enum(DRIVER_LICENSE_TYPES)).optional()
const drivableVehicleTypesSchema = z.array(z.enum(DRIVER_DRIVABLE_VEHICLE_TYPES)).optional()

export const createDriverSchema = z.object({
  branchId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  licenseNumber: z.string().max(50).optional(),
  licenseExpiry: z.string().datetime({ offset: true }).optional(),
  licenseTypes: licenseTypesSchema,
  drivableVehicleTypes: drivableVehicleTypesSchema,
  assignedVehicleId: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export const updateDriverSchema = createDriverSchema.partial().extend({
  currentStatus: z.enum(["available", "on_job", "maintenance", "inactive"]).optional(),
  isActive: z.boolean().optional(),
})

export type CreateDriverInput = z.infer<typeof createDriverSchema>
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>

function toDriverUncheckedUpdateData(input: UpdateDriverInput): Prisma.DriverUncheckedUpdateInput {
  const {
    branchId,
    assignedVehicleId,
    licenseExpiry,
    licenseTypes,
    drivableVehicleTypes,
    firstName,
    lastName,
    phone,
    licenseNumber,
    notes,
    currentStatus,
    isActive,
  } = input

  return {
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(phone !== undefined ? { phone: phone ?? null } : {}),
    ...(licenseNumber !== undefined ? { licenseNumber: licenseNumber ?? null } : {}),
    ...(licenseExpiry !== undefined
      ? { licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null }
      : {}),
    ...(notes !== undefined ? { notes: notes ?? null } : {}),
    ...(currentStatus !== undefined ? { currentStatus } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(branchId !== undefined ? { branchId } : {}),
    ...(assignedVehicleId !== undefined ? { assignedVehicleId: assignedVehicleId ?? null } : {}),
    ...(licenseTypes !== undefined ? { licenseTypes } : {}),
    ...(drivableVehicleTypes !== undefined ? { drivableVehicleTypes } : {}),
  }
}

export async function listDrivers(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: string | null
    search?: string | null
    includeInactive?: boolean
  }
) {
  const accessibleBranchIds = getBranchIds(params.roles).filter((bid) =>
    hasPermission(params.roles, bid, "transport_drivers", "read")
  )
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    (params.branchId
      ? hasPermission(params.roles, params.branchId, "transport_drivers", "read")
      : accessibleBranchIds.length > 0)
  if (!canRead) throw new ForbiddenError()

  const branchFilter = params.branchId
    ? { branchId: params.branchId }
    : isAdminInAnyBranch(params.roles)
      ? {}
      : { branchId: { in: accessibleBranchIds } }

  return db.driver.findMany({
    where: {
      companyId: params.companyId,
      ...branchFilter,
      ...(params.status ? { currentStatus: params.status as never } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
              { code: { contains: params.search, mode: "insensitive" } },
              { phone: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      branch: { select: { id: true, name: true } },
      assignedVehicle: { select: { id: true, plateNumber: true, name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

export async function getDriverById(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const driver = await db.driver.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: {
      branch: { select: { id: true, name: true } },
      assignedVehicle: { select: { id: true, plateNumber: true, name: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 10,
        include: { job: { select: { id: true, jobNumber: true, status: true } } },
      },
    },
  })
  if (!driver) throw new NotFoundError("Driver not found")
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, driver.branchId, "transport_drivers", "read")
  if (!canRead) throw new ForbiddenError()
  return driver
}

export async function createDriver(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CreateDriverInput }
) {
  const canCreate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, params.input.branchId, "transport_drivers", "create")
  if (!canCreate) throw new ForbiddenError()

  const code = await generateDriverCode(db, params.companyId)
  const {
    branchId,
    assignedVehicleId,
    licenseTypes,
    drivableVehicleTypes,
    firstName,
    lastName,
    phone,
    licenseNumber,
    licenseExpiry,
    notes,
  } = params.input

  return db.driver.create({
    data: {
      code,
      companyId: params.companyId,
      branchId,
      firstName,
      lastName,
      phone,
      licenseNumber,
      licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined,
      notes,
      licenseTypes: licenseTypes ?? [],
      drivableVehicleTypes: drivableVehicleTypes ?? [],
      assignedVehicleId: assignedVehicleId ?? null,
    },
  })
}

export async function updateDriver(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; input: UpdateDriverInput }
) {
  const driver = await db.driver.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!driver) throw new NotFoundError("Driver not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, driver.branchId, "transport_drivers", "update")
  if (!canUpdate) throw new ForbiddenError()

  return db.driver.update({
    where: { id: params.id },
    data: toDriverUncheckedUpdateData(params.input),
  })
}

export async function deleteDriver(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const driver = await db.driver.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!driver) throw new NotFoundError("Driver not found")
  const canDelete =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, driver.branchId, "transport_drivers", "delete")
  if (!canDelete) throw new ForbiddenError()

  return db.driver.update({ where: { id: params.id }, data: { isActive: false } })
}
