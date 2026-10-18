import { describe, expect, it } from "vitest"
import {
  buildMonthCells,
  shiftDateKey,
  shiftMonthKey,
  sumPresentByMonth,
} from "@/modules/hr/application/attendance-day-calendar"

describe("shiftDateKey", () => {
  it("steps across month and year boundaries", () => {
    expect(shiftDateKey("2026-10-18", 1)).toBe("2026-10-19")
    expect(shiftDateKey("2026-10-18", -1)).toBe("2026-10-17")
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31")
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("leaves an invalid key unchanged", () => {
    expect(shiftDateKey("18-10-2026", 1)).toBe("18-10-2026")
  })
})

describe("shiftMonthKey", () => {
  it("steps across years", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12")
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01")
  })
})

describe("sumPresentByMonth", () => {
  it("sums daily headcount per month and skips empty or invalid days", () => {
    expect(
      sumPresentByMonth([
        { date: "2026-10-02", present: 10 },
        { date: "2026-09-30", present: 4 },
        { date: "2026-10-01", present: 3 },
        { date: "2026-10-03", present: 0 },
        { date: "not-a-date", present: 9 },
      ])
    ).toEqual([
      { month: "2026-09", total: 4 },
      { month: "2026-10", total: 13 },
    ])
  })
})

describe("buildMonthCells", () => {
  it("starts the week on Sunday and pads the grid", () => {
    const cells = buildMonthCells("2026-10")
    expect(cells[0]).toBeNull()
    expect(cells[4]).toBe("2026-10-01")
    expect(cells.filter((day) => day != null)).toHaveLength(31)
    expect(cells.length % 7).toBe(0)
    expect(cells.at(-1)).toBe("2026-10-31")
  })
})
