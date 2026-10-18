import { describe, expect, it } from "vitest"
import { presentOt, summarizeManHour } from "@/modules/hr/application/attendance-man-hour"

const TZ = "Asia/Bangkok"
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00.000Z`)

describe("summarizeManHour", () => {
  it("counts a full day as 8 hours after deducting lunch", () => {
    const result = summarizeManHour(at("01:00"), at("10:00"), TZ)
    expect(result.manMinutes).toBe(8 * 60)
    expect(result.otBefore).toBeNull()
    expect(result.otAfter).toBeNull()
  })

  it("reduces man hours when the person arrives late", () => {
    const result = summarizeManHour(at("01:30"), at("10:00"), TZ)
    expect(result.manMinutes).toBe(7 * 60 + 30)
    expect(result.lateMinutes).toBe(30)
    expect(result.otBefore).toBeNull()
  })

  it("reports zero late minutes when the first scan is at or before 08:00", () => {
    expect(summarizeManHour(at("01:00"), at("10:00"), TZ).lateMinutes).toBe(0)
    expect(summarizeManHour(at("00:40"), at("10:00"), TZ).lateMinutes).toBe(0)
    expect(summarizeManHour(at("01:21"), null, TZ).lateMinutes).toBe(21)
  })

  it("reduces man hours when the person leaves before the end of the shift", () => {
    const result = summarizeManHour(at("01:00"), at("09:00"), TZ)
    expect(result.manMinutes).toBe(7 * 60)
    expect(result.otAfter).toBeNull()
  })

  it("does not deduct lunch when the span ends before the break", () => {
    const result = summarizeManHour(at("01:00"), at("04:00"), TZ)
    expect(result.manMinutes).toBe(3 * 60)
  })

  it("ignores scans within 30 minutes outside the shift", () => {
    const result = summarizeManHour(at("00:40"), at("10:20"), TZ)
    expect(result.manMinutes).toBe(8 * 60)
    expect(result.otBefore).toBeNull()
    expect(result.otAfter).toBeNull()
  })

  it("asks to confirm the full outside minutes when a scan is more than 30 minutes early or late", () => {
    const result = summarizeManHour(at("00:20"), at("10:40"), TZ)
    expect(result.manMinutes).toBe(8 * 60)
    expect(result.otBefore).toEqual({ at: at("00:20"), minutes: 40, needsConfirm: true })
    expect(result.otAfter).toEqual({ at: at("10:40"), minutes: 40, needsConfirm: true })
  })

  it("returns no man hours for a single scan and still flags an early scan", () => {
    const result = summarizeManHour(at("00:00"), null, TZ)
    expect(result.manMinutes).toBe(0)
    expect(result.otBefore).toEqual({ at: at("00:00"), minutes: 60, needsConfirm: true })
    expect(result.otAfter).toBeNull()
  })
})

describe("presentOt", () => {
  const candidate = { at: at("00:20"), minutes: 40, needsConfirm: true as const }

  it("stays pending until a decision matches this scan", () => {
    expect(presentOt(candidate, null)?.status).toBe("PENDING")
    expect(
      presentOt(candidate, {
        side: "BEFORE",
        punchAt: at("00:00"),
        decision: "OT",
        otMinutes: 60,
      })?.status
    ).toBe("PENDING")
  })

  it("keeps a matching OT decision", () => {
    expect(
      presentOt(candidate, {
        side: "BEFORE",
        punchAt: at("00:20"),
        decision: "OT",
        otMinutes: 40,
      })
    ).toMatchObject({ status: "OT", minutes: 40 })
  })
})
