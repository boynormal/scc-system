import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { findActiveAsset } from "@/modules/assets"
import { notifyFuelTankLow } from "@/modules/notifications"
import { assertFuelAnywhere, assertFuelInBranch, fuelBranchWhere } from "./fuel-access"
import {
  applyAdjust,
  applyDispense,
  applyReceive,
  applyReversal,
  toNumber,
  type LedgerEffect,
} from "./fuel-calc"
import { parseOrThrow } from "./fuel-validation"

export const FUEL_TXN_TYPES = ["RECEIVE", "DISPENSE", "ADJUST", "TRANSFER_OUT", "TRANSFER_IN", "REVERSAL"] as const
export const FUEL_TARGET_TYPES = ["ASSET", "OTHER"] as const
export const FUEL_METER_TYPES = ["ODOMETER", "HOUR_METER", "NONE"] as const

const DEFAULT_PAGE_SIZE = 50
/** Clock skew allowed for "now" entries coming from client devices. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const occurredAtInput = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))

const requiredOccurredAt = z.preprocess(
  (v) => (v === null || v === undefined ? "" : v),
  z.string().trim().min(1, "กรุณาระบุวันเวลา")
)

export const receiveFuelSchema = z.object({
  tankId: z.string().uuid(),
  quantity: z.coerce.number().finite().positive(),
  unitCost: z.coerce.number().finite().min(0),
  supplierId: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  documentNo: optionalText(50),
  occurredAt: requiredOccurredAt,
  remark: optionalText(1000),
})

export const dispenseFuelSchema = z
  .object({
    tankId: z.string().uuid(),
    quantity: z.coerce.number().finite().positive(),
    targetType: z.enum(FUEL_TARGET_TYPES),
    assetId: z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
    otherTargetName: optionalText(255),
    otherTargetNote: optionalText(1000),
    meterType: z.enum(FUEL_METER_TYPES).default("NONE"),
    meterReading: z
      .union([z.coerce.number().finite().min(0), z.literal(""), z.null()])
      .optional()
      .transform((v) => (typeof v === "number" ? v : null)),
    receiverName: optionalText(255),
    occurredAt: requiredOccurredAt,
    remark: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.targetType === "ASSET" && !v.assetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assetId"], message: "กรุณาเลือกสินทรัพย์" })
    }
    if (v.targetType === "OTHER" && !v.otherTargetName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherTargetName"], message: "กรุณาระบุผู้รับน้ำมัน" })
    }
  })

export const adjustFuelSchema = z.object({
  tankId: z.string().uuid(),
  measuredQty: z.coerce.number().finite().min(0),
  occurredAt: occurredAtInput,
  remark: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(1000),
})

export const reverseFuelSchema = z.object({
  remark: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(1000),
})

export type ReceiveFuelInput = z.input<typeof receiveFuelSchema>
export type DispenseFuelInput = z.input<typeof dispenseFuelSchema>
export type AdjustFuelInput = z.input<typeof adjustFuelSchema>
export type ReverseFuelInput = z.input<typeof reverseFuelSchema>

function resolveOccurredAt(value: string | null): Date {
  if (!value) return new Date()
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันเวลาไม่ถูกต้อง")
  if (d.getTime() > Date.now() + FUTURE_TOLERANCE_MS) throw new ValidationError("วันเวลาต้องไม่อยู่ในอนาคต")
  return d
}

export const fuelTxnInclude = {
  branch: { select: { id: true, name: true } },
  tank: {
    select: { id: true, code: true, name: true, fuelType: { select: { name: true, unit: true } } },
  },
  supplier: { select: { id: true, name: true } },
  asset: { select: { id: true, code: true, name: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  reversedBy: { select: { id: true, occurredAt: true } },
} satisfies Prisma.FuelTransactionInclude

export function serializeFuelTxn(row: Prisma.FuelTransactionGetPayload<{ include: typeof fuelTxnInclude }>) {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    tankId: row.tankId,
    tankCode: row.tank.code,
    tankName: row.tank.name,
    fuelTypeName: row.tank.fuelType.name,
    unit: row.tank.fuelType.unit,
    type: row.type,
    quantity: toNumber(row.quantity),
    unitCost: toNumber(row.unitCost),
    totalCost: toNumber(row.totalCost),
    balanceAfter: toNumber(row.balanceAfter),
    avgCostAfter: toNumber(row.avgCostAfter),
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    documentNo: row.documentNo,
    targetType: row.targetType,
    assetId: row.assetId,
    assetCode: row.asset?.code ?? null,
    assetName: row.asset?.name ?? null,
    otherTargetName: row.otherTargetName,
    otherTargetNote: row.otherTargetNote,
    meterType: row.meterType,
    meterReading: row.meterReading === null ? null : toNumber(row.meterReading),
    receiverName: row.receiverName,
    occurredAt: row.occurredAt.toISOString(),
    remark: row.remark,
    reversalOfId: row.reversalOfId,
    reversedById: row.reversedBy?.id ?? null,
    createdByName: row.creator ? `${row.creator.firstName} ${row.creator.lastName}`.trim() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export type FuelTxnDto = ReturnType<typeof serializeFuelTxn>

type Tx = Prisma.TransactionClient

type LockedTank = {
  id: string
  companyId: string
  branchId: string
  code: string
  name: string
  capacity: Prisma.Decimal
  minLevel: Prisma.Decimal
  currentQty: Prisma.Decimal
  avgCost: Prisma.Decimal
  isActive: boolean
  unit: string
}

/** Row-lock the tank so concurrent movements serialize on its balance. */
async function lockTank(tx: Tx, companyId: string, tankId: string): Promise<LockedTank> {
  await tx.$queryRaw`SELECT id FROM fuel_tanks WHERE id = ${tankId}::uuid FOR UPDATE`
  const tank = await tx.fuelTank.findFirst({
    where: { id: tankId, companyId, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      code: true,
      name: true,
      capacity: true,
      minLevel: true,
      currentQty: true,
      avgCost: true,
      isActive: true,
      fuelType: { select: { unit: true } },
    },
  })
  if (!tank) throw new NotFoundError("ไม่พบถังน้ำมัน")
  return { ...tank, unit: tank.fuelType.unit }
}

async function findTankBranch(db: PrismaClient, companyId: string, tankId: string) {
  const tank = await db.fuelTank.findFirst({
    where: { id: tankId, companyId, deletedAt: null },
    select: { branchId: true },
  })
  if (!tank) throw new NotFoundError("ไม่พบถังน้ำมัน")
  return tank.branchId
}

function stateOf(tank: LockedTank) {
  return { qty: tank.currentQty, avgCost: tank.avgCost, capacity: tank.capacity }
}

async function writeLedger(
  tx: Tx,
  tank: LockedTank,
  effect: LedgerEffect,
  data: Omit<
    Prisma.FuelTransactionUncheckedCreateInput,
    "companyId" | "branchId" | "tankId" | "quantity" | "unitCost" | "totalCost" | "balanceAfter" | "avgCostAfter"
  >
) {
  const row = await tx.fuelTransaction.create({
    data: {
      ...data,
      companyId: tank.companyId,
      branchId: tank.branchId,
      tankId: tank.id,
      quantity: effect.quantity,
      unitCost: effect.unitCost,
      totalCost: effect.totalCost,
      balanceAfter: effect.balanceAfter,
      avgCostAfter: effect.avgCostAfter,
    },
    include: fuelTxnInclude,
  })
  await tx.fuelTank.update({
    where: { id: tank.id },
    data: { currentQty: effect.balanceAfter, avgCost: effect.avgCostAfter },
  })
  return row
}

async function maybeNotifyLow(db: PrismaClient, tank: LockedTank, effect: LedgerEffect) {
  const before = toNumber(tank.currentQty)
  const after = toNumber(effect.balanceAfter)
  const min = toNumber(tank.minLevel)
  if (min <= 0 || !(before >= min && after < min)) return
  try {
    await notifyFuelTankLow(db, {
      id: tank.id,
      branchId: tank.branchId,
      code: tank.code,
      name: tank.name,
      currentQty: after,
      minLevel: min,
      unit: tank.unit,
    })
  } catch (error) {
    console.error("[fuel] low-level notification failed", error)
  }
}

export async function receiveFuel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; input: ReceiveFuelInput }
) {
  const input = parseOrThrow(receiveFuelSchema, params.input)
  const branchId = await findTankBranch(db, params.companyId, input.tankId)
  assertFuelInBranch(params.roles, branchId, "create")
  const occurredAt = resolveOccurredAt(input.occurredAt)
  if (input.supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: input.supplierId, companyId: params.companyId, isActive: true },
      select: { id: true },
    })
    if (!supplier) throw new ValidationError("ผู้ขายไม่ถูกต้อง")
  }
  const row = await db.$transaction(async (tx) => {
    const tank = await lockTank(tx, params.companyId, input.tankId)
    if (!tank.isActive) throw new ValidationError("ถังนี้ปิดใช้งานแล้ว")
    const effect = applyReceive(stateOf(tank), input.quantity, input.unitCost)
    return writeLedger(tx, tank, effect, {
      type: "RECEIVE",
      supplierId: input.supplierId,
      documentNo: input.documentNo,
      occurredAt,
      remark: input.remark,
      createdBy: params.userId,
    })
  })
  return { data: serializeFuelTxn(row) }
}

/** Latest and next meter readings of the asset around a point in time (non-reversed dispenses only). */
async function meterNeighbours(
  tx: Tx | PrismaClient,
  params: { assetId: string; meterType: "ODOMETER" | "HOUR_METER"; at: Date }
) {
  const base: Prisma.FuelTransactionWhereInput = {
    assetId: params.assetId,
    type: "DISPENSE",
    meterType: params.meterType,
    meterReading: { not: null },
    reversedBy: { is: null },
  }
  const [prev, next] = await Promise.all([
    tx.fuelTransaction.findFirst({
      where: { ...base, occurredAt: { lte: params.at } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      select: { meterReading: true, occurredAt: true },
    }),
    tx.fuelTransaction.findFirst({
      where: { ...base, occurredAt: { gt: params.at } },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      select: { meterReading: true, occurredAt: true },
    }),
  ])
  return { prev, next }
}

export async function dispenseFuel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; input: DispenseFuelInput }
) {
  const input = parseOrThrow(dispenseFuelSchema, params.input)
  const branchId = await findTankBranch(db, params.companyId, input.tankId)
  assertFuelInBranch(params.roles, branchId, "create")
  const occurredAt = resolveOccurredAt(input.occurredAt)
  const isAsset = input.targetType === "ASSET"

  const result = await db.$transaction(async (tx) => {
    const tank = await lockTank(tx, params.companyId, input.tankId)
    if (!tank.isActive) throw new ValidationError("ถังนี้ปิดใช้งานแล้ว")

    let meterType: (typeof FUEL_METER_TYPES)[number] = "NONE"
    let meterReading: number | null = null
    if (isAsset) {
      const asset = await findActiveAsset(tx, { companyId: params.companyId, id: input.assetId! })
      if (!asset) throw new ValidationError("สินทรัพย์ไม่ถูกต้องหรือไม่ได้ใช้งานแล้ว")
      if (asset.branchId !== tank.branchId) throw new ValidationError("สินทรัพย์ต้องอยู่สาขาเดียวกับถังน้ำมัน")
      // The asset register decides the meter; a meter type sent by the client is ignored.
      meterType = asset.fuelMeterType
      if (meterType !== "NONE") {
        if (input.meterReading === null) throw new ValidationError("กรุณากรอกเลขไมล์/ชั่วโมง")
        meterReading = input.meterReading
      }
      if (meterType !== "NONE" && meterReading !== null) {
        const { prev, next } = await meterNeighbours(tx, { assetId: asset.id, meterType, at: occurredAt })
        if (prev && meterReading < toNumber(prev.meterReading)) {
          throw new ValidationError(`เลขไมล์/ชั่วโมงต้องไม่น้อยกว่าครั้งก่อน (${toNumber(prev.meterReading).toLocaleString("th-TH")})`)
        }
        if (next && meterReading > toNumber(next.meterReading)) {
          throw new ValidationError(`เลขไมล์/ชั่วโมงต้องไม่มากกว่ารายการถัดไป (${toNumber(next.meterReading).toLocaleString("th-TH")})`)
        }
      }
    }

    const effect = applyDispense(stateOf(tank), input.quantity)
    const row = await writeLedger(tx, tank, effect, {
      type: "DISPENSE",
      targetType: input.targetType,
      assetId: isAsset ? input.assetId : null,
      otherTargetName: isAsset ? null : input.otherTargetName,
      otherTargetNote: isAsset ? null : input.otherTargetNote,
      meterType,
      meterReading,
      receiverName: input.receiverName,
      occurredAt,
      remark: input.remark,
      createdBy: params.userId,
    })
    return { row, tank, effect }
  })
  await maybeNotifyLow(db, result.tank, result.effect)
  return { data: serializeFuelTxn(result.row) }
}

export async function adjustFuel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; input: AdjustFuelInput }
) {
  const input = parseOrThrow(adjustFuelSchema, params.input)
  const branchId = await findTankBranch(db, params.companyId, input.tankId)
  assertFuelInBranch(params.roles, branchId, "approve")
  const occurredAt = resolveOccurredAt(input.occurredAt)
  const row = await db.$transaction(async (tx) => {
    const tank = await lockTank(tx, params.companyId, input.tankId)
    const effect = applyAdjust(stateOf(tank), input.measuredQty)
    return writeLedger(tx, tank, effect, {
      type: "ADJUST",
      occurredAt,
      remark: input.remark,
      createdBy: params.userId,
    })
  })
  return { data: serializeFuelTxn(row) }
}

export async function reverseFuelTransaction(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; input: ReverseFuelInput }
) {
  const input = parseOrThrow(reverseFuelSchema, params.input)
  const original = await db.fuelTransaction.findFirst({
    where: { id: params.id, companyId: params.companyId },
    select: {
      id: true,
      tankId: true,
      branchId: true,
      type: true,
      quantity: true,
      unitCost: true,
      reversedBy: { select: { id: true } },
    },
  })
  if (!original) throw new NotFoundError("ไม่พบรายการ")
  assertFuelInBranch(params.roles, original.branchId, "approve")
  if (original.type === "REVERSAL") throw new ValidationError("รายการยกเลิกไม่สามารถยกเลิกซ้ำได้")
  if (original.reversedBy) throw new ValidationError("รายการนี้ถูกยกเลิกไปแล้ว")

  try {
    const row = await db.$transaction(async (tx) => {
      const tank = await lockTank(tx, params.companyId, original.tankId)
      const effect = applyReversal(stateOf(tank), original)
      return writeLedger(tx, tank, effect, {
        type: "REVERSAL",
        reversalOfId: original.id,
        occurredAt: new Date(),
        remark: input.remark,
        createdBy: params.userId,
      })
    })
    return { data: serializeFuelTxn(row) }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ValidationError("รายการนี้ถูกยกเลิกไปแล้ว")
    }
    throw error
  }
}

function parseDateBoundary(value: string | null | undefined, endOfDay: boolean): Date | null {
  if (!value) return null
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
  return Number.isFinite(d.getTime()) ? d : null
}

export type FuelTxnFilter = {
  branchId?: string | null
  tankId?: string | null
  type?: string | null
  assetId?: string | null
  targetType?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
}

export function buildFuelTxnWhere(
  companyId: string,
  roles: UserRole[],
  filter: FuelTxnFilter
): Prisma.FuelTransactionWhereInput {
  const where: Prisma.FuelTransactionWhereInput = {
    companyId,
    branchId: fuelBranchWhere(roles, "read", filter.branchId),
  }
  const uuid = z.string().uuid()
  if (filter.tankId && uuid.safeParse(filter.tankId).success) where.tankId = filter.tankId
  if (filter.assetId && uuid.safeParse(filter.assetId).success) where.assetId = filter.assetId
  if (filter.type && FUEL_TXN_TYPES.includes(filter.type as (typeof FUEL_TXN_TYPES)[number])) {
    where.type = filter.type as (typeof FUEL_TXN_TYPES)[number]
  }
  if (filter.targetType && FUEL_TARGET_TYPES.includes(filter.targetType as (typeof FUEL_TARGET_TYPES)[number])) {
    where.targetType = filter.targetType as (typeof FUEL_TARGET_TYPES)[number]
  }
  const from = parseDateBoundary(filter.dateFrom, false)
  const to = parseDateBoundary(filter.dateTo, true)
  if (from || to) where.occurredAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  const q = filter.search?.trim()
  if (q) {
    where.OR = [
      { documentNo: { contains: q, mode: "insensitive" } },
      { otherTargetName: { contains: q, mode: "insensitive" } },
      { receiverName: { contains: q, mode: "insensitive" } },
      { remark: { contains: q, mode: "insensitive" } },
      { asset: { is: { code: { contains: q, mode: "insensitive" } } } },
      { asset: { is: { name: { contains: q, mode: "insensitive" } } } },
    ]
  }
  return where
}

export async function listFuelTransactions(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; filter: FuelTxnFilter; page?: number; pageSize?: number }
) {
  assertFuelAnywhere(params.roles, "read")
  const where = buildFuelTxnWhere(params.companyId, params.roles, params.filter)
  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize =
    params.pageSize && params.pageSize > 0 && params.pageSize <= 500 ? params.pageSize : DEFAULT_PAGE_SIZE
  const [rows, total] = await Promise.all([
    db.fuelTransaction.findMany({
      where,
      include: fuelTxnInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.fuelTransaction.count({ where }),
  ])
  return { data: rows.map(serializeFuelTxn), total, page, pageSize }
}

/** Last odometer and hour-meter readings per asset, for the dispense form. */
export async function lastMeterReadings(db: PrismaClient, assetIds: string[]) {
  if (assetIds.length === 0) return new Map<string, { odometer: number | null; hourMeter: number | null }>()
  const rows = await db.fuelTransaction.findMany({
    where: {
      assetId: { in: assetIds },
      type: "DISPENSE",
      meterType: { in: ["ODOMETER", "HOUR_METER"] },
      meterReading: { not: null },
      reversedBy: { is: null },
    },
    distinct: ["assetId", "meterType"],
    orderBy: [{ assetId: "asc" }, { meterType: "asc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
    select: { assetId: true, meterType: true, meterReading: true },
  })
  const map = new Map<string, { odometer: number | null; hourMeter: number | null }>()
  for (const r of rows) {
    if (!r.assetId) continue
    const entry = map.get(r.assetId) ?? { odometer: null, hourMeter: null }
    if (r.meterType === "ODOMETER") entry.odometer = toNumber(r.meterReading)
    else entry.hourMeter = toNumber(r.meterReading)
    map.set(r.assetId, entry)
  }
  return map
}
