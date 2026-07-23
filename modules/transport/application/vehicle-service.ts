import { z } from "zod"
import type { PrismaClient, VehicleStatus } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, getBranchIds, type UserRole } from "@/lib/permissions"

export const createVehicleSchema = z.object({
  branchId: z.string().uuid(),
  plateNumber: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  vehicleType: z.string().min(1).max(50),
  maxWeightKg: z.number().positive().optional(),
  loadCapacityKg: z.number().positive().optional(),
  volumeM3: z.number().positive().optional(),
  gpsDeviceId: z.string().max(100).optional(),
  mileage: z.number().min(0).default(0),
  notes: z.string().optional(),
})

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  currentStatus: z.enum(["available", "on_job", "maintenance", "inactive"]).optional(),
  isActive: z.boolean().optional(),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>

async function assertGpsDeviceIdUnique(
  db: PrismaClient,
  companyId: string,
  gpsDeviceId: string | undefined | null,
  excludeVehicleId?: string
) {
  const imei = gpsDeviceId?.trim()
  if (!imei) return

  const duplicate = await db.transportVehicle.findFirst({
    where: {
      companyId,
      gpsDeviceId: imei,
      ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {}),
    },
    select: { id: true, plateNumber: true },
  })
  if (duplicate) {
    throw new ValidationError(`IMEI นี้ถูกใช้กับรถ ${duplicate.plateNumber} แล้ว`)
  }
}

export async function listVehicles(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    status?: VehicleStatus | null
    search?: string | null
    includeInactive?: boolean
  }
) {
  const accessibleBranchIds = getBranchIds(params.roles).filter((bid) =>
    hasPermission(params.roles, bid, "transport_vehicles", "read")
  )
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    (params.branchId
      ? hasPermission(params.roles, params.branchId, "transport_vehicles", "read")
      : accessibleBranchIds.length > 0)
  if (!canRead) throw new ForbiddenError()

  const branchFilter = params.branchId
    ? { branchId: params.branchId }
    : isAdminInAnyBranch(params.roles)
      ? {}
      : { branchId: { in: accessibleBranchIds } }

  return db.transportVehicle.findMany({
    where: {
      companyId: params.companyId,
      ...branchFilter,
      ...(params.status ? { currentStatus: params.status } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
      ...(params.search
        ? {
            OR: [
              { plateNumber: { contains: params.search, mode: "insensitive" } },
              { name: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { plateNumber: "asc" },
  })
}

export async function getVehicleById(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: {
      branch: { select: { id: true, name: true } },
      drivers: { where: { isActive: true }, select: { id: true, firstName: true, lastName: true, code: true } },
    },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  const canRead =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, vehicle.branchId, "transport_vehicles", "read")
  if (!canRead) throw new ForbiddenError()
  return vehicle
}

export async function createVehicle(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CreateVehicleInput }
) {
  const canCreate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, params.input.branchId, "transport_vehicles", "create")
  if (!canCreate) throw new ForbiddenError()

  const existing = await db.transportVehicle.findFirst({
    where: { companyId: params.companyId, plateNumber: params.input.plateNumber },
  })
  if (existing) throw new ValidationError("Plate number already exists")

  await assertGpsDeviceIdUnique(db, params.companyId, params.input.gpsDeviceId)

  return db.transportVehicle.create({
    data: { ...params.input, companyId: params.companyId },
  })
}

export async function updateVehicle(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; input: UpdateVehicleInput }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  const canUpdate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, vehicle.branchId, "transport_vehicles", "update")
  if (!canUpdate) throw new ForbiddenError()

  await assertGpsDeviceIdUnique(db, params.companyId, params.input.gpsDeviceId, params.id)

  return db.transportVehicle.update({ where: { id: params.id }, data: params.input })
}

export async function deleteVehicle(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  const canDelete =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, vehicle.branchId, "transport_vehicles", "delete")
  if (!canDelete) throw new ForbiddenError()

  return db.transportVehicle.update({ where: { id: params.id }, data: { isActive: false } })
}
