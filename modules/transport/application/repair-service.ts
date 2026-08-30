import { z } from "zod"
import type { PrismaClient, TransportRepairStatus } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { hasPermission, isAdminInAnyBranch, getBranchIds, type UserRole } from "@/lib/permissions"
import { getBangkokDateRange, getBangkokTodayRange } from "./transport-date-utils"
import {
  TRANSPORT_PAYMENT_METHODS,
  type TransportPaymentMethodOption,
} from "./payment-options"

const paymentMethodSchema = z.enum(TRANSPORT_PAYMENT_METHODS)

function refineCostWithPaymentMethod(
  data: { repairCost?: number | null; paymentMethod?: TransportPaymentMethodOption | null },
  ctx: z.RefinementCtx
) {
  const cost = data.repairCost
  if (cost != null && cost > 0 && !data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentMethod"],
      message: "กรุณาเลือกวิธีจ่ายเมื่อมียอดอ้างอิง",
    })
  }
}

export const createRepairSchema = z
  .object({
    vehicleId: z.string().uuid(),
    symptom: z.string().min(1).max(2000),
    notes: z.string().max(2000).optional(),
    mileageAtReport: z.number().min(0).optional(),
    repairCost: z.number().min(0).nullable().optional(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
  })
  .superRefine(refineCostWithPaymentMethod)

export type CreateRepairInput = z.infer<typeof createRepairSchema>

const OPEN_STATUSES: TransportRepairStatus[] = ["reported", "in_repair", "inspection"]
/** Block new create only while vehicle has an active repair queue — inspection alone is allowed. */
const BLOCK_CREATE_STATUSES: TransportRepairStatus[] = ["reported", "in_repair"]
const LIST_TAKE_LIMIT = 300
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

const ACTIVE_JOB_STATUSES = [
  "driver_accepted",
  "en_route",
  "at_pickup",
  "loading",
  "departed",
  "at_destination",
  "unloading",
] as const

const repairInclude = {
  vehicle: {
    select: {
      id: true,
      plateNumber: true,
      name: true,
      vehicleType: true,
      currentStatus: true,
      mileage: true,
    },
  },
  branch: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  startedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
} as const

async function assertVehiclePermission(
  roles: UserRole[],
  branchId: string,
  action: "create" | "read" | "update"
) {
  const ok =
    isAdminInAnyBranch(roles) || hasPermission(roles, branchId, "transport_vehicles", action)
  if (!ok) throw new ForbiddenError()
}

/** Optional reference baht — not a Finance Expense. Required only when amount > 0. */
function assertReferenceAmountIfPresent(params: {
  repairCost: number | null
  paymentMethod: TransportPaymentMethodOption | null
}) {
  if (params.repairCost == null || Number.isNaN(params.repairCost)) return
  if (params.repairCost < 0) {
    throw new ValidationError("ยอดอ้างอิงต้องเป็นตัวเลขที่ไม่ติดลบ")
  }
  if (params.repairCost > 0 && !params.paymentMethod) {
    throw new ValidationError("กรุณาเลือกวิธีจ่ายเมื่อมียอดอ้างอิง")
  }
}

export async function listRepairs(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    vehicleId?: string | null
    status?: TransportRepairStatus | null
    statusGroup?: "open" | null
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

  let statusWhere: { status?: TransportRepairStatus | { in: TransportRepairStatus[] } } = {}
  if (params.statusGroup === "open") {
    statusWhere = { status: { in: OPEN_STATUSES } }
  } else if (params.status) {
    statusWhere = { status: params.status }
  }

  let reportedAtWhere: { reportedAt?: { gte?: Date; lte?: Date } } = {}
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null
  if (from || to) {
    if (from && !YMD_RE.test(from)) throw new ValidationError("from must be YYYY-MM-DD")
    if (to && !YMD_RE.test(to)) throw new ValidationError("to must be YYYY-MM-DD")
    const rangeFrom = from ?? to!
    const rangeTo = to ?? from!
    if (rangeFrom > rangeTo) throw new ValidationError("from must be on or before to")
    const { start, end } = getBangkokDateRange(rangeFrom, rangeTo)
    reportedAtWhere = { reportedAt: { gte: start, lte: end } }
  }

  const take = Math.min(Math.max(params.take ?? LIST_TAKE_LIMIT, 1), LIST_TAKE_LIMIT)

  const where = {
    companyId: params.companyId,
    ...branchFilter,
    ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
    ...statusWhere,
    ...reportedAtWhere,
  }

  const [total, items] = await Promise.all([
    db.transportRepairLog.count({ where }),
    db.transportRepairLog.findMany({
      where,
      include: repairInclude,
      orderBy: { reportedAt: "desc" },
      take,
    }),
  ])

  return {
    items,
    meta: {
      total,
      take,
      truncated: total > items.length,
    },
  }
}

/** Counts for open-queue tabs (แจ้งซ่อม / กำลังซ่อม / ตรวจสอบ); ignores date range. */
export async function countOpenRepairsByStatus(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    vehicleId?: string | null
    branchId?: string | null
  }
): Promise<{ reported: number; in_repair: number; inspection: number }> {
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

  const groups = await db.transportRepairLog.groupBy({
    by: ["status"],
    where: {
      companyId: params.companyId,
      ...branchFilter,
      ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
      status: { in: OPEN_STATUSES },
    },
    _count: { _all: true },
  })

  const counts = { reported: 0, in_repair: 0, inspection: 0 }
  for (const g of groups) {
    if (g.status === "reported" || g.status === "in_repair" || g.status === "inspection") {
      counts[g.status] = g._count._all
    }
  }
  return counts
}

export async function getRepairById(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
    include: repairInclude,
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "read")
  return repair
}

export async function createRepair(
  db: PrismaClient,
  params: {
    companyId: string
    userId: string
    roles: UserRole[]
    input: CreateRepairInput
  }
) {
  const vehicle = await db.transportVehicle.findFirst({
    where: { id: params.input.vehicleId, companyId: params.companyId, isActive: true },
  })
  if (!vehicle) throw new NotFoundError("Vehicle not found")

  const canCreate =
    isAdminInAnyBranch(params.roles) ||
    hasPermission(params.roles, vehicle.branchId, "transport_vehicles", "create") ||
    hasPermission(params.roles, vehicle.branchId, "transport_vehicles", "update")
  if (!canCreate) throw new ForbiddenError()

  const openExisting = await db.transportRepairLog.findFirst({
    where: {
      vehicleId: vehicle.id,
      companyId: params.companyId,
      status: { in: BLOCK_CREATE_STATUSES },
    },
    select: { id: true, status: true },
  })
  if (openExisting) {
    const msg =
      openExisting.status === "in_repair"
        ? "รถคันนี้กำลังซ่อมอยู่แล้ว — ส่งตรวจสอบหรือจัดการใบเดิมก่อน"
        : "รถคันนี้มีใบแจ้งซ่อมที่ยังไม่ปิด — เข้าซ่อมหรือยกเลิกใบเดิมก่อน"
    throw new ValidationError(msg)
  }

  return db.transportRepairLog.create({
    data: {
      companyId: params.companyId,
      branchId: vehicle.branchId,
      vehicleId: vehicle.id,
      symptom: params.input.symptom.trim(),
      notes: params.input.notes?.trim() || null,
      status: "reported",
      reportedById: params.userId,
      mileageAtReport:
        params.input.mileageAtReport ?? (vehicle.mileage != null ? Number(vehicle.mileage) : null),
      repairCost: params.input.repairCost ?? null,
      paymentMethod: params.input.paymentMethod ?? null,
    },
    include: repairInclude,
  })
}

async function assertNoActiveJobToday(db: PrismaClient, companyId: string, vehicleId: string) {
  const { start, end } = getBangkokTodayRange()
  const activeJob = await db.transportJob.findFirst({
    where: {
      companyId,
      assignment: { vehicleId },
      OR: [
        { status: { in: [...ACTIVE_JOB_STATUSES] } },
        { status: "assigned", scheduledDate: { gte: start, lte: end } },
        { status: "assigned", scheduledDate: null },
      ],
    },
    select: { id: true, jobNumber: true, status: true },
  })
  if (activeJob) {
    throw new ValidationError(
      `รถมีใบงานที่ยังไม่จบ (${activeJob.jobNumber}) — จบงาน ยกเลิกใบงาน หรือเปลี่ยนมอบหมายไปคันอื่นก่อนเข้าซ่อม`
    )
  }
}

export async function startRepair(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; roles: UserRole[] }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  if (repair.status !== "reported") {
    throw new ValidationError("เข้าซ่อมได้เฉพาะใบที่สถานะแจ้งซ่อมแล้วเท่านั้น")
  }

  await assertNoActiveJobToday(db, params.companyId, repair.vehicleId)

  const now = new Date()
  const [updated] = await db.$transaction([
    db.transportRepairLog.update({
      where: { id: repair.id },
      data: {
        status: "in_repair",
        startedById: params.userId,
        startedAt: now,
      },
      include: repairInclude,
    }),
    db.transportVehicle.update({
      where: { id: repair.vehicleId },
      data: { currentStatus: "maintenance" },
    }),
  ])
  return updated
}

export async function markRepairInspection(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; roles: UserRole[] }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  if (repair.status !== "in_repair") {
    throw new ValidationError("ส่งตรวจสอบได้เฉพาะใบที่กำลังซ่อมเท่านั้น")
  }

  const [updated] = await db.$transaction([
    db.transportRepairLog.update({
      where: { id: repair.id },
      data: { status: "inspection" },
      include: repairInclude,
    }),
    db.transportVehicle.update({
      where: { id: repair.vehicleId },
      data: { currentStatus: "available" },
    }),
  ])
  return updated
}

export async function closeRepair(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    userId: string
    roles: UserRole[]
    repairCost?: number | null
  }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  if (repair.status !== "inspection") {
    throw new ValidationError("ปิดงานได้เฉพาะใบที่สถานะตรวจสอบเท่านั้น")
  }

  if (params.repairCost != null && (Number.isNaN(params.repairCost) || params.repairCost < 0)) {
    throw new ValidationError("ยอดอ้างอิงต้องเป็นตัวเลขที่ไม่ติดลบ")
  }

  const finalCost =
    params.repairCost !== undefined
      ? params.repairCost
      : repair.repairCost != null
        ? Number(repair.repairCost)
        : null
  assertReferenceAmountIfPresent({
    repairCost: finalCost,
    paymentMethod: repair.paymentMethod,
  })

  const now = new Date()
  const [updated] = await db.$transaction([
    db.transportRepairLog.update({
      where: { id: repair.id },
      data: {
        status: "closed",
        closedById: params.userId,
        closedAt: now,
        ...(params.repairCost !== undefined
          ? { repairCost: params.repairCost }
          : {}),
      },
      include: repairInclude,
    }),
    db.transportVehicle.update({
      where: { id: repair.vehicleId },
      data: { currentStatus: "available" },
    }),
  ])
  return updated
}

export async function cancelRepair(
  db: PrismaClient,
  params: { id: string; companyId: string; userId: string; roles: UserRole[] }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  if (repair.status !== "reported") {
    throw new ValidationError("ยกเลิกได้เฉพาะใบที่ยังไม่ได้เข้าซ่อม")
  }

  return db.transportRepairLog.update({
    where: { id: repair.id },
    data: {
      status: "cancelled",
      closedById: params.userId,
      closedAt: new Date(),
    },
    include: repairInclude,
  })
}

export const updateRepairSchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    symptom: z.string().min(1).max(2000).optional(),
    notes: z.string().max(2000).nullable().optional(),
    repairCost: z.number().min(0).nullable().optional(),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    status: z.enum(["reported", "in_repair", "inspection", "closed", "cancelled"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.repairCost != null && data.repairCost > 0 && data.paymentMethod === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "กรุณาเลือกวิธีจ่ายเมื่อมียอดอ้างอิง",
      })
    }
  })

export type UpdateRepairInput = z.infer<typeof updateRepairSchema>

export async function updateRepair(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    userId: string
    roles: UserRole[]
    input: UpdateRepairInput
  }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  const input = params.input
  if (
    input.vehicleId === undefined &&
    input.symptom === undefined &&
    input.notes === undefined &&
    input.repairCost === undefined &&
    input.paymentMethod === undefined &&
    input.status === undefined
  ) {
    throw new ValidationError("ไม่มีข้อมูลที่จะอัปเดต")
  }

  const nextVehicleId = input.vehicleId ?? repair.vehicleId
  const nextStatus = input.status ?? repair.status
  const vehicleChanged = nextVehicleId !== repair.vehicleId
  const statusChanged = nextStatus !== repair.status

  const nextCost =
    input.repairCost !== undefined
      ? input.repairCost
      : repair.repairCost != null
        ? Number(repair.repairCost)
        : null
  const nextPayment =
    input.paymentMethod !== undefined ? input.paymentMethod : repair.paymentMethod
  if (nextStatus === "closed") {
    if (statusChanged && repair.status !== "inspection") {
      throw new ValidationError("ปิดงานได้เฉพาะใบที่สถานะตรวจสอบเท่านั้น")
    }
    assertReferenceAmountIfPresent({
      repairCost: nextCost,
      paymentMethod: nextPayment,
    })
  }

  let nextBranchId = repair.branchId
  if (vehicleChanged) {
    const vehicle = await db.transportVehicle.findFirst({
      where: { id: nextVehicleId, companyId: params.companyId, isActive: true },
    })
    if (!vehicle) throw new NotFoundError("Vehicle not found")
    await assertVehiclePermission(params.roles, vehicle.branchId, "update")
    nextBranchId = vehicle.branchId
  }

  if (
    nextStatus === "reported" ||
    nextStatus === "in_repair" ||
    nextStatus === "inspection"
  ) {
    await assertNoOtherOpenRepair(db, {
      companyId: params.companyId,
      vehicleId: nextVehicleId,
      excludeId: repair.id,
    })
  }

  if (nextStatus === "in_repair" && (statusChanged || vehicleChanged)) {
    await assertNoActiveJobToday(db, params.companyId, nextVehicleId)
  }

  const now = new Date()
  const statusData: {
    status?: TransportRepairStatus
    startedById?: string | null
    startedAt?: Date | null
    closedById?: string | null
    closedAt?: Date | null
  } = {}

  if (statusChanged) {
    statusData.status = nextStatus
    if (nextStatus === "reported") {
      statusData.startedById = null
      statusData.startedAt = null
      statusData.closedById = null
      statusData.closedAt = null
    } else if (nextStatus === "in_repair") {
      statusData.startedById = repair.startedById ?? params.userId
      statusData.startedAt = repair.startedAt ?? now
      statusData.closedById = null
      statusData.closedAt = null
    } else if (nextStatus === "inspection") {
      statusData.startedById = repair.startedById ?? params.userId
      statusData.startedAt = repair.startedAt ?? now
      statusData.closedById = null
      statusData.closedAt = null
    } else if (nextStatus === "closed" || nextStatus === "cancelled") {
      if (!repair.startedAt && nextStatus === "closed") {
        statusData.startedById = repair.startedById ?? params.userId
        statusData.startedAt = repair.startedAt ?? now
      }
      statusData.closedById = params.userId
      statusData.closedAt = now
    }
  }

  const wasInRepair = repair.status === "in_repair"
  const willBeInRepair = nextStatus === "in_repair"

  return db.$transaction(async (tx) => {
    const updated = await tx.transportRepairLog.update({
      where: { id: repair.id },
      data: {
        ...(vehicleChanged ? { vehicleId: nextVehicleId, branchId: nextBranchId } : {}),
        ...(input.symptom !== undefined ? { symptom: input.symptom.trim() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.repairCost !== undefined ? { repairCost: input.repairCost } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
        ...statusData,
      },
      include: repairInclude,
    })

    // Sync vehicle status for previous vehicle if leaving maintenance on this log
    if (wasInRepair && (!willBeInRepair || vehicleChanged)) {
      await tx.transportVehicle.update({
        where: { id: repair.vehicleId },
        data: { currentStatus: "available" },
      })
    }

    if (willBeInRepair) {
      await tx.transportVehicle.update({
        where: { id: nextVehicleId },
        data: { currentStatus: "maintenance" },
      })
    }

    return updated
  })
}

export const revertRepairSchema = z.object({
  to: z.enum(["reported", "in_repair", "inspection"]),
})

export type RevertRepairInput = z.infer<typeof revertRepairSchema>

async function assertNoOtherOpenRepair(
  db: PrismaClient,
  params: { companyId: string; vehicleId: string; excludeId: string }
) {
  const other = await db.transportRepairLog.findFirst({
    where: {
      companyId: params.companyId,
      vehicleId: params.vehicleId,
      id: { not: params.excludeId },
      status: { in: OPEN_STATUSES },
    },
    select: { id: true, status: true },
  })
  if (other) {
    throw new ValidationError("รถคันนี้มีใบแจ้งซ่อมที่ยังเปิดอยู่แล้ว — จัดการใบเดิมก่อน")
  }
}

export async function revertRepair(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    userId: string
    roles: UserRole[]
    to: "reported" | "in_repair" | "inspection"
  }
) {
  const repair = await db.transportRepairLog.findFirst({
    where: { id: params.id, companyId: params.companyId },
  })
  if (!repair) throw new NotFoundError("Repair log not found")
  await assertVehiclePermission(params.roles, repair.branchId, "update")

  // in_repair → reported
  if (params.to === "reported" && repair.status === "in_repair") {
    const [updated] = await db.$transaction([
      db.transportRepairLog.update({
        where: { id: repair.id },
        data: {
          status: "reported",
          startedById: null,
          startedAt: null,
        },
        include: repairInclude,
      }),
      db.transportVehicle.update({
        where: { id: repair.vehicleId },
        data: { currentStatus: "available" },
      }),
    ])
    return updated
  }

  // cancelled → reported
  if (params.to === "reported" && repair.status === "cancelled") {
    await assertNoOtherOpenRepair(db, {
      companyId: params.companyId,
      vehicleId: repair.vehicleId,
      excludeId: repair.id,
    })
    return db.transportRepairLog.update({
      where: { id: repair.id },
      data: {
        status: "reported",
        closedById: null,
        closedAt: null,
      },
      include: repairInclude,
    })
  }

  // inspection → in_repair
  if (params.to === "in_repair" && repair.status === "inspection") {
    await assertNoActiveJobToday(db, params.companyId, repair.vehicleId)
    const [updated] = await db.$transaction([
      db.transportRepairLog.update({
        where: { id: repair.id },
        data: { status: "in_repair" },
        include: repairInclude,
      }),
      db.transportVehicle.update({
        where: { id: repair.vehicleId },
        data: { currentStatus: "maintenance" },
      }),
    ])
    return updated
  }

  // closed → inspection (vehicle stays available)
  if (params.to === "inspection" && repair.status === "closed") {
    await assertNoOtherOpenRepair(db, {
      companyId: params.companyId,
      vehicleId: repair.vehicleId,
      excludeId: repair.id,
    })
    return db.transportRepairLog.update({
      where: { id: repair.id },
      data: {
        status: "inspection",
        closedById: null,
        closedAt: null,
        startedById: repair.startedById ?? params.userId,
        startedAt: repair.startedAt ?? new Date(),
      },
      include: repairInclude,
    })
  }

  throw new ValidationError(
    `ไม่สามารถย้อนจาก ${repair.status} ไปเป็น ${params.to} ได้`
  )
}

/** ใช้ตอน job complete/unassign — อย่ารีเซ็ตเป็น available ถ้ากำลังซ่อม */
export async function vehicleHasOpenInRepair(
  db: PrismaClient,
  params: { companyId: string; vehicleId: string }
): Promise<boolean> {
  const open = await db.transportRepairLog.findFirst({
    where: {
      companyId: params.companyId,
      vehicleId: params.vehicleId,
      status: "in_repair",
    },
    select: { id: true },
  })
  return !!open
}
