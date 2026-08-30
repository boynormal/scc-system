import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, getBranchIds, type UserRole } from "@/lib/permissions"
import { getBangkokDateRange } from "./transport-date-utils"
import {
  getDefaultWheelLayout,
  isValidWheelPosition,
  normalizeWheelLayout,
  validateWheelLayoutAgainstCount,
  vehicleWheelCountSchema,
  type VehicleWheelConfig,
  type WheelLayout,
} from "./vehicle-wheel-layouts"
import { TIRE_WORK_TYPES, type TireWorkType } from "./tire-options"
import { TRANSPORT_PAYMENT_METHODS } from "./payment-options"

export { TIRE_WORK_TYPES, TIRE_WORK_TYPE_LABELS } from "./tire-options"

export type TireWheelItem = {
  position: number
  workType: TireWorkType
}

const paymentMethodSchema = z.enum(TRANSPORT_PAYMENT_METHODS)

const tireWheelItemSchema = z.object({
  position: z.number().int().positive(),
  workType: z.enum(TIRE_WORK_TYPES),
})

const wheelsSchema = z.array(tireWheelItemSchema).min(1)

async function resolveVehicleTypeWheelConfig(
  db: PrismaClient,
  params: { companyId: string; vehicleTypeName: string }
): Promise<VehicleWheelConfig | null> {
  const row = await db.transportVehicleType.findFirst({
    where: {
      companyId: params.companyId,
      name: params.vehicleTypeName,
      isActive: true,
    },
    select: { wheelCount: true, wheelLayout: true },
  })
  if (!row?.wheelCount) return null
  const countParsed = vehicleWheelCountSchema.safeParse(row.wheelCount)
  if (!countParsed.success) return null

  const fromDb = normalizeWheelLayout(row.wheelLayout)
  if (fromDb) {
    const validated = validateWheelLayoutAgainstCount(fromDb, countParsed.data)
    if (validated.ok) {
      return { wheelCount: countParsed.data, wheelLayout: validated.layout }
    }
  }

  return {
    wheelCount: countParsed.data,
    wheelLayout: getDefaultWheelLayout(countParsed.data),
  }
}

function normalizeWheels(wheels: TireWheelItem[]): TireWheelItem[] {
  const byPosition = new Map<number, TireWorkType>()
  for (const item of wheels) {
    byPosition.set(item.position, item.workType)
  }
  return [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .map(([position, workType]) => ({ position, workType }))
}

function assertWheelsInLayout(layout: WheelLayout, wheels: TireWheelItem[]) {
  for (const item of wheels) {
    if (!isValidWheelPosition(layout, item.position)) {
      throw new ValidationError(`ตำแหน่งล้อ ${item.position} ไม่อยู่ในแผนผังของประเภทรถนี้`)
    }
  }
}

export const createTireLogSchema = z
  .object({
    vehicleId: z.string().uuid(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "workDate must be YYYY-MM-DD"),
    wheels: wheelsSchema,
    cost: z.number().min(0).nullable().optional(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cost != null && data.cost > 0 && !data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "กรุณาเลือกวิธีจ่ายเมื่อมียอดอ้างอิง",
      })
    }
    const positions = data.wheels.map((w) => w.position)
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wheels"],
        message: "ตำแหน่งล้อซ้ำกันไม่ได้",
      })
    }
  })

export const updateTireLogSchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    wheels: wheelsSchema.optional(),
    cost: z.number().min(0).nullable().optional(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cost != null && data.cost > 0 && data.paymentMethod === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "กรุณาเลือกวิธีจ่ายเมื่อมียอดอ้างอิง",
      })
    }
    if (data.wheels) {
      const positions = data.wheels.map((w) => w.position)
      if (new Set(positions).size !== positions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wheels"],
          message: "ตำแหน่งล้อซ้ำกันไม่ได้",
        })
      }
    }
  })

export type CreateTireLogInput = z.infer<typeof createTireLogSchema>
export type UpdateTireLogInput = z.infer<typeof updateTireLogSchema>

const LIST_TAKE_LIMIT = 300
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

const tireInclude = {
  vehicle: {
    select: {
      id: true,
      plateNumber: true,
      name: true,
      vehicleType: true,
      branchId: true,
    },
  },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const

function assertVehiclePermission(
  roles: UserRole[],
  branchId: string,
  action: "create" | "read" | "update" | "delete"
) {
  const ok =
    isAdminInAnyBranch(roles) || hasPermission(roles, branchId, "transport_vehicles", action)
  if (!ok) throw new ForbiddenError()
}

function workDateToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`)
}

async function resolveWheelConfigForVehicle(
  db: PrismaClient,
  params: { companyId: string; vehicleTypeName: string }
) {
  const config = await resolveVehicleTypeWheelConfig(db, {
    companyId: params.companyId,
    vehicleTypeName: params.vehicleTypeName,
  })
  if (!config) {
    throw new ValidationError(
      `ประเภทรถ "${params.vehicleTypeName}" ยังไม่ได้ตั้งจำนวนล้อ — ไปตั้งค่าที่ข้อมูลพื้นฐาน > ประเภทรถ`
    )
  }
  return config
}

export async function listTireLogs(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    vehicleId?: string | null
    branchId?: string | null
    from?: string | null
    to?: string | null
    take?: number
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

  let workDateWhere: { workDate?: { gte?: Date; lte?: Date } } = {}
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null
  if (from || to) {
    if (from && !YMD_RE.test(from)) throw new ValidationError("from must be YYYY-MM-DD")
    if (to && !YMD_RE.test(to)) throw new ValidationError("to must be YYYY-MM-DD")
    const range = getBangkokDateRange(from ?? to!, to ?? from!)
    workDateWhere = { workDate: { gte: range.start, lte: range.end } }
  }

  const take = Math.min(Math.max(params.take ?? LIST_TAKE_LIMIT, 1), LIST_TAKE_LIMIT)

  const items = await db.transportTireLog.findMany({
    where: {
      companyId: params.companyId,
      ...branchFilter,
      ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
      ...workDateWhere,
    },
    include: tireInclude,
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: take + 1,
  })

  const truncated = items.length > take
  return {
    items: truncated ? items.slice(0, take) : items,
    meta: { total: truncated ? take : items.length, take, truncated },
  }
}

export async function getVehicleWheelLayout(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; vehicleId: string }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.vehicleId, companyId: params.companyId, isActive: true },
    select: { id: true, plateNumber: true, name: true, vehicleType: true, branchId: true },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  assertVehiclePermission(params.roles, vehicle.branchId, "read")

  const config = await resolveWheelConfigForVehicle(db, {
    companyId: params.companyId,
    vehicleTypeName: vehicle.vehicleType,
  })

  return {
    vehicle,
    wheelCount: config.wheelCount,
    wheelLayout: config.wheelLayout,
  }
}

export async function createTireLog(
  db: PrismaClient,
  params: {
    companyId: string
    userId: string
    roles: UserRole[]
    input: CreateTireLogInput
  }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.input.vehicleId, companyId: params.companyId, isActive: true },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  assertVehiclePermission(params.roles, vehicle.branchId, "create")

  const config = await resolveWheelConfigForVehicle(db, {
    companyId: params.companyId,
    vehicleTypeName: vehicle.vehicleType,
  })
  const wheels = normalizeWheels(params.input.wheels)
  assertWheelsInLayout(config.wheelLayout, wheels)

  return db.transportTireLog.create({
    data: {
      companyId: params.companyId,
      branchId: vehicle.branchId,
      vehicleId: vehicle.id,
      workDate: workDateToDate(params.input.workDate),
      wheels: wheels as Prisma.InputJsonValue,
      cost: params.input.cost ?? null,
      paymentMethod: params.input.paymentMethod ?? null,
      notes: params.input.notes?.trim() || null,
      createdById: params.userId,
    },
    include: tireInclude,
  })
}

export async function updateTireLog(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    roles: UserRole[]
    input: UpdateTireLogInput
  }
) {
  const existing = await db.transportTireLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError("Tire log not found")
  assertVehiclePermission(params.roles, existing.branchId, "update")

  const nextVehicleId = params.input.vehicleId ?? existing.vehicleId
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: nextVehicleId, companyId: params.companyId, isActive: true },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")
  if (vehicle.id !== existing.vehicleId) {
    assertVehiclePermission(params.roles, vehicle.branchId, "update")
  }

  const config = await resolveWheelConfigForVehicle(db, {
    companyId: params.companyId,
    vehicleTypeName: vehicle.vehicleType,
  })

  let nextWheels: TireWheelItem[] | undefined
  if (params.input.wheels !== undefined) {
    nextWheels = normalizeWheels(params.input.wheels)
  } else {
    const parsed = wheelsSchema.safeParse(existing.wheels)
    if (!parsed.success) {
      throw new ValidationError("ข้อมูลล้อในรายการเดิมไม่ถูกต้อง")
    }
    nextWheels = normalizeWheels(parsed.data)
  }
  assertWheelsInLayout(config.wheelLayout, nextWheels)

  return db.transportTireLog.update({
    where: { id: params.id },
    data: {
      vehicleId: vehicle.id,
      branchId: vehicle.branchId,
      ...(params.input.workDate !== undefined
        ? { workDate: workDateToDate(params.input.workDate) }
        : {}),
      wheels: nextWheels as Prisma.InputJsonValue,
      ...(params.input.cost !== undefined ? { cost: params.input.cost } : {}),
      ...(params.input.paymentMethod !== undefined
        ? { paymentMethod: params.input.paymentMethod }
        : {}),
      ...(params.input.notes !== undefined
        ? { notes: params.input.notes?.trim() || null }
        : {}),
    },
    include: tireInclude,
  })
}

export async function deleteTireLog(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const existing = await db.transportTireLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!existing) throw new NotFoundError("Tire log not found")
  assertVehiclePermission(params.roles, existing.branchId, "delete")

  await db.transportTireLog.delete({ where: { id: params.id } })
  return { ok: true }
}
