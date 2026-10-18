import { describe, expect, it } from "vitest"
import {
  dedupePunchTimes,
  isDateKey,
  localDateKey,
  summarizeDay,
  summarizeHomeBranchDay,
  summarizePunchesByDay,
  zonedDayRange,
} from "@/modules/hr/application/attendance-daily-summary"

const TZ = "Asia/Bangkok"
const at = (iso: string) => new Date(iso)

describe("localDateKey / zonedDayRange", () => {
  it("uses the branch calendar date, not UTC", () => {
    expect(localDateKey(at("2026-10-16T17:30:00Z"), TZ)).toBe("2026-10-17")
    expect(localDateKey(at("2026-10-16T16:59:59Z"), TZ)).toBe("2026-10-16")
  })

  it("returns the Bangkok day as [17:00Z previous day, 17:00Z)", () => {
    const r = zonedDayRange("2026-10-17", TZ)
    expect(r.start.toISOString()).toBe("2026-10-16T17:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-10-17T17:00:00.000Z")
  })

  it("validates date keys", () => {
    expect(isDateKey("2026-10-17")).toBe(true)
    expect(isDateKey("2026-02-30")).toBe(false)
    expect(isDateKey("17-10-2026")).toBe(false)
  })
})

describe("summarizeDay", () => {
  it("drops repeat scans within one minute", () => {
    const out = dedupePunchTimes([
      at("2026-10-17T01:00:30Z"),
      at("2026-10-17T01:00:00Z"),
      at("2026-10-17T10:00:00Z"),
    ])
    expect(out.map((d) => d.toISOString())).toEqual(["2026-10-17T01:00:00.000Z", "2026-10-17T10:00:00.000Z"])
  })

  it("marks one scan as SINGLE_PUNCH with no out time", () => {
    expect(summarizeDay([at("2026-10-17T01:00:00Z"), at("2026-10-17T01:00:20Z")])).toEqual({
      firstIn: at("2026-10-17T01:00:00Z"),
      lastOut: null,
      punchCount: 1,
      workedMinutes: 0,
      status: "SINGLE_PUNCH",
    })
  })

  it("uses first and last scan for COMPLETE days", () => {
    const s = summarizeDay([at("2026-10-17T05:00:00Z"), at("2026-10-17T01:02:00Z"), at("2026-10-17T10:05:00Z")])
    expect(s?.status).toBe("COMPLETE")
    expect(s?.firstIn.toISOString()).toBe("2026-10-17T01:02:00.000Z")
    expect(s?.lastOut?.toISOString()).toBe("2026-10-17T10:05:00.000Z")
    expect(s?.punchCount).toBe(3)
    expect(s?.workedMinutes).toBe(543)
  })

  it("returns null for no scans", () => {
    expect(summarizeDay([])).toBeNull()
  })
})

describe("summarizePunchesByDay", () => {
  it("groups by person and branch-local date", () => {
    const out = summarizePunchesByDay(
      [
        { personnelId: "a", punchAt: at("2026-10-16T23:00:00Z") },
        { personnelId: "a", punchAt: at("2026-10-17T10:00:00Z") },
        { personnelId: "a", punchAt: at("2026-10-17T18:00:00Z") },
        { personnelId: "b", punchAt: at("2026-10-17T02:00:00Z") },
      ],
      TZ
    )
    expect([...out.keys()].sort()).toEqual(["a|2026-10-17", "a|2026-10-18", "b|2026-10-17"])
    expect(out.get("a|2026-10-17")?.summary.punchCount).toBe(2)
    expect(out.get("a|2026-10-18")?.summary.status).toBe("SINGLE_PUNCH")
  })
})

describe("summarizeHomeBranchDay", () => {
  const person = {
    personnelId: "pad-person",
    rosterNo: "001",
    displayName: "สมชาย",
    jobGroup: null,
    badgeNumber: "12",
  }

  it("labels in and out with the scanner branch of each punch", () => {
    const rows = summarizeHomeBranchDay([
      { ...person, punchAt: at("2026-10-17T01:00:00Z"), branchCode: "NRS" },
      { ...person, punchAt: at("2026-10-17T10:00:00Z"), branchCode: "PAD" },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      firstInBranchCode: "NRS",
      lastOutBranchCode: "PAD",
      status: "COMPLETE",
      punchCount: 2,
    })
  })

  it("keeps a person off the scanner branch when their home branch is elsewhere", () => {
    const punches = [
      { ...person, homeBranchId: "pad", punchAt: at("2026-10-17T01:00:00Z"), branchCode: "NRS" },
    ]
    const onScannerBranch = punches.filter((punch) => punch.homeBranchId === "nrs")
    const onHomeBranch = punches.filter((punch) => punch.homeBranchId === "pad")
    expect(summarizeHomeBranchDay(onScannerBranch)).toEqual([])
    expect(summarizeHomeBranchDay(onHomeBranch)).toHaveLength(1)
    expect(summarizeHomeBranchDay(onHomeBranch)[0]?.firstInBranchCode).toBe("NRS")
  })
})
