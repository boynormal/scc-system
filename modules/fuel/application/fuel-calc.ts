import { Prisma } from "@prisma/client"
import { ValidationError } from "@/lib/errors"

const D = Prisma.Decimal
type Dec = Prisma.Decimal
type Num = Dec | number | string

export type TankState = { qty: Num; avgCost: Num; capacity: Num }

export type LedgerEffect = {
  /** Signed: + into the tank, - out of the tank. */
  quantity: Dec
  unitCost: Dec
  totalCost: Dec
  balanceAfter: Dec
  avgCostAfter: Dec
}

const QTY_DP = 2
const COST_DP = 4
const MONEY_DP = 2

function dec(v: Num): Dec {
  return v instanceof D ? v : new D(v)
}

function qty(v: Dec): Dec {
  return v.toDecimalPlaces(QTY_DP, D.ROUND_HALF_UP)
}

function cost(v: Dec): Dec {
  return v.toDecimalPlaces(COST_DP, D.ROUND_HALF_UP)
}

function money(v: Dec): Dec {
  return v.toDecimalPlaces(MONEY_DP, D.ROUND_HALF_UP)
}

function assertPositive(v: Dec, label: string) {
  if (!v.isFinite() || v.lte(0)) throw new ValidationError(`${label}ต้องมากกว่า 0`)
}

/** Fuel in: moving-average cost is re-weighted by the incoming price. */
export function applyReceive(state: TankState, quantity: Num, unitCost: Num): LedgerEffect {
  const q = qty(dec(quantity))
  const price = cost(dec(unitCost))
  assertPositive(q, "จำนวนลิตร")
  if (!price.isFinite() || price.lt(0)) throw new ValidationError("ราคาต่อลิตรต้องไม่ติดลบ")
  const cur = dec(state.qty)
  const avg = dec(state.avgCost)
  const balance = qty(cur.plus(q))
  if (balance.gt(dec(state.capacity))) {
    throw new ValidationError(`เกินความจุถัง (คงเหลือรับได้ ${dec(state.capacity).minus(cur).toFixed(2)} ลิตร)`)
  }
  const newAvg = cost(cur.times(avg).plus(q.times(price)).div(balance))
  return {
    quantity: q,
    unitCost: price,
    totalCost: money(q.times(price)),
    balanceAfter: balance,
    avgCostAfter: newAvg,
  }
}

/** Fuel out: charged at the current average cost; the average does not change. */
export function applyDispense(state: TankState, quantity: Num): LedgerEffect {
  const q = qty(dec(quantity))
  assertPositive(q, "จำนวนลิตร")
  const cur = dec(state.qty)
  const avg = cost(dec(state.avgCost))
  if (q.gt(cur)) throw new ValidationError(`น้ำมันในถังไม่พอ (คงเหลือ ${cur.toFixed(2)} ลิตร)`)
  return {
    quantity: q.negated(),
    unitCost: avg,
    totalCost: money(q.times(avg)),
    balanceAfter: qty(cur.minus(q)),
    avgCostAfter: avg,
  }
}

/** Physical count: the difference is valued at the current average cost. */
export function applyAdjust(state: TankState, measuredQty: Num): LedgerEffect {
  const measured = qty(dec(measuredQty))
  if (!measured.isFinite() || measured.lt(0)) throw new ValidationError("ปริมาณที่วัดได้ต้องไม่ติดลบ")
  if (measured.gt(dec(state.capacity))) throw new ValidationError("ปริมาณที่วัดได้เกินความจุถัง")
  const cur = dec(state.qty)
  const delta = qty(measured.minus(cur))
  if (delta.isZero()) throw new ValidationError("ปริมาณที่วัดได้เท่ากับยอดในระบบ ไม่ต้องปรับ")
  const avg = cost(dec(state.avgCost))
  return {
    quantity: delta,
    unitCost: avg,
    totalCost: money(delta.abs().times(avg)),
    balanceAfter: measured,
    avgCostAfter: avg,
  }
}

/**
 * Undo an earlier movement at its original unit cost.
 * The tank's average is recomputed from the remaining value so later movements stay consistent.
 */
export function applyReversal(
  state: TankState,
  original: { quantity: Num; unitCost: Num }
): LedgerEffect {
  const origQty = qty(dec(original.quantity))
  const price = cost(dec(original.unitCost))
  const q = origQty.negated()
  const cur = dec(state.qty)
  const avg = dec(state.avgCost)
  const balance = qty(cur.plus(q))
  if (balance.lt(0)) {
    throw new ValidationError(`ยกเลิกไม่ได้: น้ำมันในถังเหลือไม่พอ (คงเหลือ ${cur.toFixed(2)} ลิตร)`)
  }
  if (balance.gt(dec(state.capacity))) throw new ValidationError("ยกเลิกไม่ได้: เกินความจุถัง")
  let newAvg: Dec
  if (balance.isZero()) {
    newAvg = cost(avg)
  } else {
    const value = cur.times(avg).plus(q.times(price))
    newAvg = cost(D.max(value, 0).div(balance))
  }
  return {
    quantity: q,
    unitCost: price,
    totalCost: money(q.abs().times(price)),
    balanceAfter: balance,
    avgCostAfter: newAvg,
  }
}

export type MeterReading = { occurredAt: Date; meterReading: Num; quantity: Num }

/**
 * Consumption from consecutive meter readings of one asset.
 * Fuel from the first fill is burned before the second reading, so the first fill's liters are excluded.
 */
export function consumptionRate(
  readings: MeterReading[],
  meterType: "ODOMETER" | "HOUR_METER"
): { distance: number; liters: number; rate: number | null } {
  const sorted = [...readings].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
  if (sorted.length < 2) return { distance: 0, liters: 0, rate: null }
  const distance = dec(sorted[sorted.length - 1].meterReading).minus(dec(sorted[0].meterReading))
  const liters = sorted.slice(1).reduce((sum, r) => sum.plus(dec(r.quantity).abs()), new D(0))
  if (distance.lte(0) || liters.lte(0)) {
    return { distance: distance.toNumber(), liters: liters.toNumber(), rate: null }
  }
  const rate = meterType === "ODOMETER" ? distance.div(liters) : liters.div(distance)
  return {
    distance: distance.toNumber(),
    liters: liters.toNumber(),
    rate: rate.toDecimalPlaces(2, D.ROUND_HALF_UP).toNumber(),
  }
}

export function toNumber(v: Num | null | undefined): number {
  if (v === null || v === undefined) return 0
  return dec(v).toNumber()
}
