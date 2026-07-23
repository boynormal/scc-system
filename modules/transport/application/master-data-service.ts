import { z } from "zod"
import type { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import {
  generateTmsCustomerCode,
  migrateLegacyCustomerCodes,
  migrateLegacyDriverCodes,
} from "./generate-entity-code"
import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type UserRole,
} from "@/lib/permissions"

const lookupSchema = z.object({
  name: z.string().min(1).max(100),
  details: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const createJobTypeSchema = lookupSchema
export const updateJobTypeSchema = lookupSchema.partial()
export const createCargoTypeSchema = lookupSchema
export const updateCargoTypeSchema = lookupSchema.partial()
export const createVehicleTypeSchema = lookupSchema
export const updateVehicleTypeSchema = lookupSchema.partial()

const tmsCustomerBaseSchema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(255).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  details: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

function withLatLngPair<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (data: { latitude?: number | null; longitude?: number | null }) => {
      const hasLat = data.latitude != null
      const hasLng = data.longitude != null
      return hasLat === hasLng
    },
    { message: "latitude and longitude must both be provided or both omitted" }
  )
}

export const createTmsCustomerSchema = withLatLngPair(tmsCustomerBaseSchema)
export const updateTmsCustomerSchema = withLatLngPair(tmsCustomerBaseSchema.partial())

function canReadTransportJobs(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "transport_jobs", "read"))
  )
}

function canWriteTransportJobs(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some(
      (bid) =>
        hasPermission(roles, bid, "transport_jobs", "create") ||
        hasPermission(roles, bid, "transport_jobs", "update")
    )
  )
}

function optText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed || null
}

export function listJobTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  if (!canReadTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportJobType.findMany({
    where: {
      companyId: params.companyId,
      ...(params.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export function createJobType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createJobTypeSchema> }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportJobType.create({
    data: {
      companyId: params.companyId,
      name: params.input.name,
      details: optText(params.input.details) ?? null,
      sortOrder: params.input.sortOrder ?? 0,
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function updateJobType(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateJobTypeSchema>
  }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportJobType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportJobType.update({
    where: { id: params.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.details !== undefined ? { details: optText(params.input.details) ?? null } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function deactivateJobType(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportJobType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportJobType.update({
    where: { id: params.id },
    data: { isActive: false },
  })
}

export function listCargoTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  if (!canReadTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportCargoType.findMany({
    where: {
      companyId: params.companyId,
      ...(params.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export function createCargoType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createCargoTypeSchema> }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportCargoType.create({
    data: {
      companyId: params.companyId,
      name: params.input.name,
      details: optText(params.input.details) ?? null,
      sortOrder: params.input.sortOrder ?? 0,
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function updateCargoType(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateCargoTypeSchema>
  }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportCargoType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportCargoType.update({
    where: { id: params.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.details !== undefined ? { details: optText(params.input.details) ?? null } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function deactivateCargoType(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportCargoType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportCargoType.update({
    where: { id: params.id },
    data: { isActive: false },
  })
}

export function listVehicleTypes(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean }
) {
  if (!canReadTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportVehicleType.findMany({
    where: {
      companyId: params.companyId,
      ...(params.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export function createVehicleType(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createVehicleTypeSchema> }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  return db.transportVehicleType.create({
    data: {
      companyId: params.companyId,
      name: params.input.name,
      details: optText(params.input.details) ?? null,
      sortOrder: params.input.sortOrder ?? 0,
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function updateVehicleType(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateVehicleTypeSchema>
  }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportVehicleType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportVehicleType.update({
    where: { id: params.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.details !== undefined ? { details: optText(params.input.details) ?? null } : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function deactivateVehicleType(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()
  const existing = await db.transportVehicleType.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()
  return db.transportVehicleType.update({
    where: { id: params.id },
    data: { isActive: false },
  })
}

export async function listTmsCustomers(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; activeOnly?: boolean; search?: string | null }
) {
  if (!canReadTransportJobs(params.roles)) throw new ForbiddenError()

  return db.tmsCustomer.findMany({
    where: {
      companyId: params.companyId,
      ...(params.activeOnly ? { isActive: true } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { code: { contains: params.search, mode: "insensitive" as const } },
              { contactName: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  })
}

export async function createTmsCustomer(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof createTmsCustomerSchema> }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()

  const code = await generateTmsCustomerCode(db, params.companyId)

  try {
    return await db.tmsCustomer.create({
      data: {
        companyId: params.companyId,
        code,
        name: params.input.name,
        contactName: params.input.contactName ?? null,
        phone: params.input.phone ?? null,
        address: params.input.address ?? null,
        latitude: params.input.latitude ?? null,
        longitude: params.input.longitude ?? null,
        details: optText(params.input.details) ?? null,
        ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const retryCode = await generateTmsCustomerCode(db, params.companyId)
      return db.tmsCustomer.create({
        data: {
          companyId: params.companyId,
          code: retryCode,
          name: params.input.name,
          contactName: params.input.contactName ?? null,
          phone: params.input.phone ?? null,
          address: params.input.address ?? null,
          latitude: params.input.latitude ?? null,
          longitude: params.input.longitude ?? null,
          details: optText(params.input.details) ?? null,
          ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
        },
      })
    }
    throw error
  }
}

export async function updateTmsCustomer(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateTmsCustomerSchema>
  }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()

  const existing = await db.tmsCustomer.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()

  return db.tmsCustomer.update({
    where: { id: params.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.contactName !== undefined ? { contactName: params.input.contactName ?? null } : {}),
      ...(params.input.phone !== undefined ? { phone: params.input.phone ?? null } : {}),
      ...(params.input.address !== undefined ? { address: params.input.address ?? null } : {}),
      ...(params.input.latitude !== undefined ? { latitude: params.input.latitude ?? null } : {}),
      ...(params.input.longitude !== undefined ? { longitude: params.input.longitude ?? null } : {}),
      ...(params.input.details !== undefined ? { details: optText(params.input.details) ?? null } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  })
}

export async function deactivateTmsCustomer(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  if (!canWriteTransportJobs(params.roles)) throw new ForbiddenError()

  const existing = await db.tmsCustomer.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError()

  return db.tmsCustomer.update({
    where: { id: params.id },
    data: { isActive: false },
  })
}

/** Seed default transport master data for a newly created company */
export async function seedTransportMasterData(db: PrismaClient, companyId: string) {
  const jobTypes = ["รับ-ส่ง", "ส่งอย่างเดียว", "รับอย่างเดียว", "Multi-stop", "ขนถ่าย"]
  const cargoTypes = ["สินค้าทั่วไป", "อาหารสัตว์", "วัตถุดิบ", "สินค้าเย็น"]
  const vehicleTypes = ["6 ล้อ", "10 ล้อ", "รถตู้", "รถกระบะ"]

  await db.transportJobType.createMany({
    data: jobTypes.map((name, i) => ({ companyId, name, sortOrder: i + 1 })),
    skipDuplicates: true,
  })
  await db.transportCargoType.createMany({
    data: cargoTypes.map((name, i) => ({ companyId, name, sortOrder: i + 1 })),
    skipDuplicates: true,
  })
  await db.transportVehicleType.createMany({
    data: vehicleTypes.map((name, i) => ({ companyId, name, sortOrder: i + 1 })),
    skipDuplicates: true,
  })
}

export async function runLegacyTransportCodeMigration(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; target?: "drivers" | "customers" | "all" }
) {
  if (!isAdminInAnyBranch(params.roles) && !canWriteTransportJobs(params.roles)) {
    throw new ForbiddenError()
  }
  const target = params.target ?? "all"
  const drivers =
    target === "customers" ? 0 : await migrateLegacyDriverCodes(db, params.companyId)
  const customers =
    target === "drivers" ? 0 : await migrateLegacyCustomerCodes(db, params.companyId)
  return { drivers, customers }
}
