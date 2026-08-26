import { describe, expect, it } from "vitest"
import {
  assertStartBeforeEnd,
  daysRemaining,
  getDueAlertLevel,
} from "@/modules/due_dates/application/due-date-utils"

const today = new Date("2026-08-22T10:00:00")

function offsetDate(days: number): Date {
  const d = new Date("2026-08-22T00:00:00")
  d.setDate(d.getDate() + days)
  return d
}

describe("daysRemaining", () => {
  it("returns 0 on the end date", () => {
    expect(daysRemaining(offsetDate(0), today)).toBe(0)
  })

  it("returns positive days before the end date", () => {
    expect(daysRemaining(offsetDate(14), today)).toBe(14)
  })

  it("returns negative days after the end date", () => {
    expect(daysRemaining(offsetDate(-3), today)).toBe(-3)
  })
})

describe("getDueAlertLevel", () => {
  it("is normal when more than 60 days remain", () => {
    expect(getDueAlertLevel(offsetDate(61), today)).toBe("normal")
  })

  it("is watch from 31 to 60 days", () => {
    expect(getDueAlertLevel(offsetDate(60), today)).toBe("watch")
    expect(getDueAlertLevel(offsetDate(31), today)).toBe("watch")
  })

  it("is approaching from 8 to 30 days", () => {
    expect(getDueAlertLevel(offsetDate(30), today)).toBe("approaching")
    expect(getDueAlertLevel(offsetDate(8), today)).toBe("approaching")
  })

  it("is urgent from 1 to 7 days", () => {
    expect(getDueAlertLevel(offsetDate(7), today)).toBe("urgent")
    expect(getDueAlertLevel(offsetDate(1), today)).toBe("urgent")
  })

  it("is expired on or after the end date", () => {
    expect(getDueAlertLevel(offsetDate(0), today)).toBe("expired")
    expect(getDueAlertLevel(offsetDate(-1), today)).toBe("expired")
  })
})

describe("assertStartBeforeEnd", () => {
  it("allows start equal to end", () => {
    const d = offsetDate(0)
    expect(() => assertStartBeforeEnd(d, d)).not.toThrow()
  })

  it("rejects start after end", () => {
    expect(() => assertStartBeforeEnd(offsetDate(2), offsetDate(1))).toThrow(/วันเริ่มต้น/)
  })
})
