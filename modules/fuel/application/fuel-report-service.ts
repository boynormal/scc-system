import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { assertFuelAnywhere } from "./fuel-access"
import { consumptionRate, toNumber, type MeterReading } from "./fuel-calc"
import { listFuelTanks } from "./fuel-tank-service"
import { buildFuelTxnWhere, listFuelTransactions, type FuelTxnFilter } from "./fuel-transaction-service"

const CSV_EXPORT_LIMIT = 10_000

const TXN_TYPE_LABEL: Record<string, string> = {
  RECEIVE: "รับเข้า",
  DISPENSE: "จ่ายออก",
  ADJUST: "ปรับยอด",
  TRANSFER_OUT: "โอนออก",
  TRANSFER_IN: "โอนเข้า",
  REVERSAL: "ยกเลิกรายการ",
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Ledger rows as CSV (UTF-8 with BOM so Excel opens Thai text correctly). */
export async function exportFuelTransactionsCsv(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; filter: FuelTxnFilter }
) {
  const { data, total } = await listFuelTransactions(db, { ...params, page: 1, pageSize: CSV_EXPORT_LIMIT })
  const header = [
    "วันเวลา",
    "สาขา",
    "ถัง",
    "ชนิดน้ำมัน",
    "ประเภท",
    "ลิตร",
    "ต้นทุน/ลิตร",
    "มูลค่า",
    "คงเหลือหลังรายการ",
    "สินทรัพย์ / ผู้รับ",
    "เลขไมล์/ชั่วโมง",
    "ผู้ขาย",
    "เลขที่เอกสาร",
    "หมายเหตุ",
    "สถานะ",
    "ผู้บันทึก",
  ]
  const lines = data.map((r) =>
    [
      new Date(r.occurredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      r.branchName,
      `${r.tankCode} ${r.tankName}`,
      r.fuelTypeName,
      TXN_TYPE_LABEL[r.type] ?? r.type,
      r.quantity,
      r.unitCost,
      r.totalCost,
      r.balanceAfter,
      r.assetCode ? `${r.assetCode} ${r.assetName ?? ""}`.trim() : r.otherTargetName,
      r.meterReading,
      r.supplierName,
      r.documentNo,
      r.remark,
      r.reversedById ? "ถูกยกเลิก" : "",
      r.createdByName,
    ]
      .map(csvCell)
      .join(",")
  )
  return {
    csv: `\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}`,
    truncated: total > data.length,
  }
}

/** Upper bound on rows pulled for in-memory consumption math. */
const CONSUMPTION_ROW_LIMIT = 20_000

export const fuelReportQuerySchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export type FuelReportQuery = z.infer<typeof fuelReportQuerySchema>

function round(n: number, dp = 2) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export async function getFuelStockReport(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  const tanks = (await listFuelTanks(db, { ...params, activeOnly: false })).data
  const byKey = new Map<
    string,
    { branchId: string; branchName: string; fuelTypeName: string; unit: string; tankCount: number; capacity: number; currentQty: number; stockValue: number }
  >()
  for (const t of tanks) {
    const key = `${t.branchId}:${t.fuelTypeId}`
    const agg = byKey.get(key) ?? {
      branchId: t.branchId,
      branchName: t.branchName,
      fuelTypeName: t.fuelTypeName,
      unit: t.unit,
      tankCount: 0,
      capacity: 0,
      currentQty: 0,
      stockValue: 0,
    }
    agg.tankCount += 1
    agg.capacity += t.capacity
    agg.currentQty += t.currentQty
    agg.stockValue += t.stockValue
    byKey.set(key, agg)
  }
  const summary = [...byKey.values()]
    .map((r) => ({ ...r, currentQty: round(r.currentQty), stockValue: round(r.stockValue), capacity: round(r.capacity) }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName, "th") || a.fuelTypeName.localeCompare(b.fuelTypeName, "th"))
  return {
    data: {
      tanks,
      summary,
      totals: {
        tankCount: tanks.length,
        lowCount: tanks.filter((t) => t.isActive && t.isLow).length,
        currentQty: round(tanks.reduce((s, t) => s + t.currentQty, 0)),
        stockValue: round(tanks.reduce((s, t) => s + t.stockValue, 0)),
      },
    },
  }
}

export async function getFuelMovementReport(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; query: FuelReportQuery }
) {
  assertFuelAnywhere(params.roles, "read")
  const where = buildFuelTxnWhere(params.companyId, params.roles, {
    branchId: params.query.branchId,
    dateFrom: params.query.dateFrom,
    dateTo: params.query.dateTo,
  })
  const groups = await db.fuelTransaction.groupBy({
    by: ["tankId", "type"],
    where,
    _sum: { quantity: true, totalCost: true },
    _count: { _all: true },
  })
  const tankIds = [...new Set(groups.map((g) => g.tankId))]
  const tanks = tankIds.length
    ? await db.fuelTank.findMany({
        where: { id: { in: tankIds } },
        select: {
          id: true,
          code: true,
          name: true,
          branch: { select: { name: true } },
          fuelType: { select: { name: true, unit: true } },
        },
      })
    : []
  const tankById = new Map(tanks.map((t) => [t.id, t]))
  const rows = new Map<
    string,
    {
      tankId: string
      tankCode: string
      tankName: string
      branchName: string
      fuelTypeName: string
      unit: string
      receivedQty: number
      receivedCost: number
      dispensedQty: number
      dispensedCost: number
      adjustedQty: number
      reversedQty: number
      txnCount: number
    }
  >()
  for (const g of groups) {
    const t = tankById.get(g.tankId)
    if (!t) continue
    const row = rows.get(g.tankId) ?? {
      tankId: t.id,
      tankCode: t.code,
      tankName: t.name,
      branchName: t.branch.name,
      fuelTypeName: t.fuelType.name,
      unit: t.fuelType.unit,
      receivedQty: 0,
      receivedCost: 0,
      dispensedQty: 0,
      dispensedCost: 0,
      adjustedQty: 0,
      reversedQty: 0,
      txnCount: 0,
    }
    const qty = toNumber(g._sum.quantity)
    const cost = toNumber(g._sum.totalCost)
    if (g.type === "RECEIVE" || g.type === "TRANSFER_IN") {
      row.receivedQty += qty
      row.receivedCost += cost
    } else if (g.type === "DISPENSE" || g.type === "TRANSFER_OUT") {
      row.dispensedQty += Math.abs(qty)
      row.dispensedCost += cost
    } else if (g.type === "ADJUST") {
      row.adjustedQty += qty
    } else if (g.type === "REVERSAL") {
      row.reversedQty += qty
    }
    row.txnCount += g._count._all
    rows.set(g.tankId, row)
  }
  const data = [...rows.values()]
    .map((r) => ({
      ...r,
      receivedQty: round(r.receivedQty),
      receivedCost: round(r.receivedCost),
      dispensedQty: round(r.dispensedQty),
      dispensedCost: round(r.dispensedCost),
      adjustedQty: round(r.adjustedQty),
      reversedQty: round(r.reversedQty),
    }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName, "th") || a.tankCode.localeCompare(b.tankCode))
  return {
    data,
    totals: {
      receivedQty: round(data.reduce((s, r) => s + r.receivedQty, 0)),
      receivedCost: round(data.reduce((s, r) => s + r.receivedCost, 0)),
      dispensedQty: round(data.reduce((s, r) => s + r.dispensedQty, 0)),
      dispensedCost: round(data.reduce((s, r) => s + r.dispensedCost, 0)),
    },
  }
}

type ConsumptionRow = {
  key: string
  targetType: "ASSET" | "OTHER"
  assetId: string | null
  assetCode: string | null
  name: string
  branchName: string
  dispenseCount: number
  liters: number
  cost: number
  odometer: { distance: number; liters: number; kmPerLiter: number | null } | null
  hourMeter: { hours: number; liters: number; litersPerHour: number | null } | null
}

/**
 * Fuel used per asset (and per free-text target) in a period.
 * Reversed dispenses are excluded; rates come from consecutive meter readings.
 */
export async function getFuelConsumptionReport(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; query: FuelReportQuery }
) {
  assertFuelAnywhere(params.roles, "read")
  const where: Prisma.FuelTransactionWhereInput = {
    ...buildFuelTxnWhere(params.companyId, params.roles, {
      branchId: params.query.branchId,
      assetId: params.query.assetId,
      dateFrom: params.query.dateFrom,
      dateTo: params.query.dateTo,
      type: "DISPENSE",
    }),
    reversedBy: { is: null },
  }
  const rows = await db.fuelTransaction.findMany({
    where,
    select: {
      targetType: true,
      assetId: true,
      otherTargetName: true,
      quantity: true,
      totalCost: true,
      meterType: true,
      meterReading: true,
      occurredAt: true,
      branch: { select: { name: true } },
      asset: { select: { code: true, name: true } },
    },
    orderBy: [{ occurredAt: "asc" }],
    take: CONSUMPTION_ROW_LIMIT,
  })

  const groups = new Map<
    string,
    ConsumptionRow & { odoReadings: MeterReading[]; hourReadings: MeterReading[] }
  >()
  for (const r of rows) {
    const isAsset = r.targetType === "ASSET" && r.assetId
    const key = isAsset ? `A:${r.assetId}` : `O:${(r.otherTargetName ?? "").trim().toLowerCase()}`
    const g = groups.get(key) ?? {
      key,
      targetType: isAsset ? ("ASSET" as const) : ("OTHER" as const),
      assetId: isAsset ? r.assetId : null,
      assetCode: r.asset?.code ?? null,
      name: r.asset?.name ?? r.otherTargetName ?? "-",
      branchName: r.branch.name,
      dispenseCount: 0,
      liters: 0,
      cost: 0,
      odometer: null,
      hourMeter: null,
      odoReadings: [],
      hourReadings: [],
    }
    const qty = Math.abs(toNumber(r.quantity))
    g.dispenseCount += 1
    g.liters += qty
    g.cost += toNumber(r.totalCost)
    if (r.meterReading !== null) {
      const reading = { occurredAt: r.occurredAt, meterReading: r.meterReading, quantity: r.quantity }
      if (r.meterType === "ODOMETER") g.odoReadings.push(reading)
      if (r.meterType === "HOUR_METER") g.hourReadings.push(reading)
    }
    groups.set(key, g)
  }

  const data: ConsumptionRow[] = [...groups.values()].map(({ odoReadings, hourReadings, ...g }) => {
    const odo = odoReadings.length >= 2 ? consumptionRate(odoReadings, "ODOMETER") : null
    const hr = hourReadings.length >= 2 ? consumptionRate(hourReadings, "HOUR_METER") : null
    return {
      ...g,
      liters: round(g.liters),
      cost: round(g.cost),
      odometer: odo ? { distance: odo.distance, liters: odo.liters, kmPerLiter: odo.rate } : null,
      hourMeter: hr ? { hours: hr.distance, liters: hr.liters, litersPerHour: hr.rate } : null,
    }
  })
  data.sort((a, b) => b.liters - a.liters)
  return {
    data,
    truncated: rows.length >= CONSUMPTION_ROW_LIMIT,
    totals: {
      liters: round(data.reduce((s, r) => s + r.liters, 0)),
      cost: round(data.reduce((s, r) => s + r.cost, 0)),
      dispenseCount: data.reduce((s, r) => s + r.dispenseCount, 0),
    },
  }
}
