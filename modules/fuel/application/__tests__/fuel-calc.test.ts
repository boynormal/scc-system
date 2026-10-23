import { describe, expect, it } from "vitest"
import { ValidationError } from "@/lib/errors"
import {
  applyAdjust,
  applyDispense,
  applyReceive,
  applyReversal,
  consumptionRate,
} from "@/modules/fuel/application/fuel-calc"

const n = (v: { toNumber(): number }) => v.toNumber()

describe("applyReceive", () => {
  it("re-weights the moving average with the incoming price", () => {
    const first = applyReceive({ qty: 0, avgCost: 0, capacity: 5000 }, 1000, 30)
    expect(n(first.balanceAfter)).toBe(1000)
    expect(n(first.avgCostAfter)).toBe(30)
    expect(n(first.totalCost)).toBe(30000)

    const second = applyReceive({ qty: 1000, avgCost: 30, capacity: 5000 }, 500, 33)
    expect(n(second.balanceAfter)).toBe(1500)
    expect(n(second.avgCostAfter)).toBe(31)
    expect(n(second.totalCost)).toBe(16500)
    expect(n(second.quantity)).toBe(500)
  })

  it("rejects overfilling the tank", () => {
    expect(() => applyReceive({ qty: 4800, avgCost: 30, capacity: 5000 }, 300, 30)).toThrow(ValidationError)
  })

  it("rejects zero quantity and negative price", () => {
    expect(() => applyReceive({ qty: 0, avgCost: 0, capacity: 100 }, 0, 30)).toThrow(ValidationError)
    expect(() => applyReceive({ qty: 0, avgCost: 0, capacity: 100 }, 10, -1)).toThrow(ValidationError)
  })
})

describe("applyDispense", () => {
  it("charges the current average and keeps it unchanged", () => {
    const out = applyDispense({ qty: 1500, avgCost: 31, capacity: 5000 }, 200)
    expect(n(out.quantity)).toBe(-200)
    expect(n(out.unitCost)).toBe(31)
    expect(n(out.totalCost)).toBe(6200)
    expect(n(out.balanceAfter)).toBe(1300)
    expect(n(out.avgCostAfter)).toBe(31)
  })

  it("rejects dispensing more than the balance", () => {
    expect(() => applyDispense({ qty: 100, avgCost: 30, capacity: 5000 }, 100.01)).toThrow(/ไม่พอ/)
  })

  it("allows emptying the tank exactly", () => {
    expect(n(applyDispense({ qty: 100, avgCost: 30, capacity: 5000 }, 100).balanceAfter)).toBe(0)
  })
})

describe("applyAdjust", () => {
  it("records the signed difference to the measured quantity", () => {
    const loss = applyAdjust({ qty: 1000, avgCost: 30, capacity: 5000 }, 990)
    expect(n(loss.quantity)).toBe(-10)
    expect(n(loss.totalCost)).toBe(300)
    expect(n(loss.balanceAfter)).toBe(990)

    const gain = applyAdjust({ qty: 1000, avgCost: 30, capacity: 5000 }, 1004.5)
    expect(n(gain.quantity)).toBe(4.5)
  })

  it("rejects no-op and above-capacity counts", () => {
    expect(() => applyAdjust({ qty: 1000, avgCost: 30, capacity: 5000 }, 1000)).toThrow(ValidationError)
    expect(() => applyAdjust({ qty: 1000, avgCost: 30, capacity: 5000 }, 6000)).toThrow(ValidationError)
  })
})

describe("applyReversal", () => {
  it("undoes a receive at its original price and restores the prior average", () => {
    const after = applyReceive({ qty: 1000, avgCost: 30, capacity: 5000 }, 500, 33)
    const rev = applyReversal(
      { qty: after.balanceAfter, avgCost: after.avgCostAfter, capacity: 5000 },
      { quantity: after.quantity, unitCost: after.unitCost }
    )
    expect(n(rev.quantity)).toBe(-500)
    expect(n(rev.balanceAfter)).toBe(1000)
    expect(n(rev.avgCostAfter)).toBe(30)
  })

  it("puts dispensed fuel back", () => {
    const out = applyDispense({ qty: 1000, avgCost: 30, capacity: 5000 }, 200)
    const rev = applyReversal(
      { qty: out.balanceAfter, avgCost: out.avgCostAfter, capacity: 5000 },
      { quantity: out.quantity, unitCost: out.unitCost }
    )
    expect(n(rev.quantity)).toBe(200)
    expect(n(rev.balanceAfter)).toBe(1000)
    expect(n(rev.avgCostAfter)).toBe(30)
  })

  it("refuses to reverse a receive whose fuel is already gone", () => {
    expect(() => applyReversal({ qty: 100, avgCost: 30, capacity: 5000 }, { quantity: 500, unitCost: 30 })).toThrow(
      /ไม่พอ/
    )
  })
})

describe("consumptionRate", () => {
  const at = (d: string) => new Date(`2026-10-${d}T08:00:00Z`)

  it("computes km per liter excluding the first fill", () => {
    const r = consumptionRate(
      [
        { occurredAt: at("01"), meterReading: 10000, quantity: -50 },
        { occurredAt: at("05"), meterReading: 10400, quantity: -40 },
        { occurredAt: at("10"), meterReading: 10800, quantity: -40 },
      ],
      "ODOMETER"
    )
    expect(r.distance).toBe(800)
    expect(r.liters).toBe(80)
    expect(r.rate).toBe(10)
  })

  it("computes liters per hour for hour meters", () => {
    const r = consumptionRate(
      [
        { occurredAt: at("01"), meterReading: 500, quantity: -100 },
        { occurredAt: at("03"), meterReading: 520, quantity: -60 },
      ],
      "HOUR_METER"
    )
    expect(r.rate).toBe(3)
  })

  it("returns null rate with fewer than two readings", () => {
    expect(consumptionRate([{ occurredAt: at("01"), meterReading: 1, quantity: -1 }], "ODOMETER").rate).toBeNull()
  })
})
