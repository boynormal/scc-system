import { describe, expect, it } from "vitest"
import {
  formatPersonnelDateTime,
  parsePersonnelDateTime,
  personnelDateKey,
  personnelDateTimeInput,
  personnelDateTimeReached,
} from "@/modules/hr/application/personnel-date-time"

describe("personnel date time", () => {
  it("reads a Bangkok wall time and keeps that calendar day", () => {
    const at = parsePersonnelDateTime("2026-10-20T08:30")
    expect(at?.toISOString()).toBe("2026-10-20T01:30:00.000Z")
    expect(personnelDateKey(at)).toBe("2026-10-20")
    expect(personnelDateTimeInput(at)).toBe("2026-10-20T08:30")
  })

  it("treats a date without a time as Bangkok midnight", () => {
    const at = parsePersonnelDateTime("2026-10-20")
    expect(personnelDateKey(at)).toBe("2026-10-20")
    expect(personnelDateTimeInput(at)).toBe("2026-10-20T00:00")
    expect(formatPersonnelDateTime("2026-10-20T08:30")).toBe("2026-10-20 08:30")
  })

  it("marks an exit reached only when its time has passed", () => {
    const now = new Date("2026-10-20T01:00:00.000Z")
    expect(personnelDateTimeReached("2026-10-20T07:30", now)).toBe(true)
    expect(personnelDateTimeReached("2026-10-20T08:30", now)).toBe(false)
  })
})
