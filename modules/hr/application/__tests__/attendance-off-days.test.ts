import { describe, expect, it } from "vitest"
import { buildAttendanceReport, type ReportFact } from "@/modules/hr/application/attendance-report"
import { isOffDay, isSunday, shouldSkipOffDay, type HolidaySpan } from "@/modules/hr/application/attendance-off-days"

const songkran: HolidaySpan = { startDate: "2026-04-13", endDate: "2026-04-15", branchIds: ["branch-a"] }

function fact(partial: Partial<ReportFact> & Pick<ReportFact, "date" | "status">): ReportFact {
  return {
    personnelId: "p1",
    displayName: "สมชาย",
    departmentName: null,
    manMinutes: 0,
    lateMinutes: 0,
    otBefore: null,
    otAfter: null,
    noteReason: null,
    note: null,
    firstIn: null,
    lastOut: null,
    ...partial,
  }
}

describe("attendance off days", () => {
  it("treats every Sunday as off for any branch", () => {
    expect(isSunday("2026-10-18")).toBe(true)
    expect(isSunday("2026-10-19")).toBe(false)
    expect(isOffDay("2026-10-18", "branch-b", [])).toBe(true)
  })

  it("applies an announced holiday only to the selected branches", () => {
    expect(isOffDay("2026-04-14", "branch-a", [songkran])).toBe(true)
    expect(isOffDay("2026-04-14", "branch-b", [songkran])).toBe(false)
    expect(isOffDay("2026-04-16", "branch-a", [songkran])).toBe(false)
  })

  it("skips a no-scan off day and keeps minutes when someone scanned", () => {
    expect(shouldSkipOffDay("2026-10-18", "branch-a", [], false)).toBe(true)
    expect(shouldSkipOffDay("2026-10-18", "branch-a", [], true)).toBe(false)

    const report = buildAttendanceReport(
      ["2026-10-18", "2026-10-19"],
      [
        fact({ date: "2026-10-19", status: "NO_SCAN" }),
        fact({ date: "2026-10-18", status: "COMPLETE", manMinutes: 480, personnelId: "p2" }),
      ]
    )
    expect(report.cards.absentDays).toBe(1)
    expect(report.cards.expectedDays).toBe(2)
    expect(report.cards.manMinutes).toBe(480)
    expect(report.cards.presentDays).toBe(1)
  })
})
