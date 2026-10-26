import { describe, expect, it } from "vitest"
import { summarizeManHour } from "@/modules/hr/application/attendance-man-hour"
import {
  buildAttendanceReport,
  buildExceptionGroups,
  buildStaffingCells,
  countsOnBranch,
  omitTodayOpenForgotScans,
  dateKeysInRange,
  filterExceptionGroups,
  type ReportFact,
} from "@/modules/hr/application/attendance-report"

const TZ = "Asia/Bangkok"
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00.000Z`)

function fact(partial: Partial<ReportFact> & Pick<ReportFact, "personnelId" | "status">): ReportFact {
  return {
    date: "2026-10-18",
    displayName: "เอ",
    departmentName: "ผลิต",
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

describe("countsOnBranch", () => {
  it("keeps a person on the home branch when no override exists", () => {
    expect(countsOnBranch("branch-a", null, "branch-a")).toBe(true)
  })

  it("drops a person from the home branch after they are counted elsewhere", () => {
    expect(countsOnBranch("branch-a", "branch-b", "branch-a")).toBe(false)
    expect(countsOnBranch("branch-a", "branch-b", "branch-b")).toBe(true)
  })
})

describe("buildAttendanceReport", () => {
  it("sums a full work day as 480 man minutes", () => {
    const hours = summarizeManHour(at("01:00"), at("10:00"), TZ)
    const report = buildAttendanceReport(
      ["2026-10-18"],
      [fact({ personnelId: "p1", status: "COMPLETE", manMinutes: hours.manMinutes, lateMinutes: hours.lateMinutes })]
    )
    expect(report.cards.manMinutes).toBe(480)
    expect(report.days[0]?.manMinutes).toBe(480)
  })

  it("does not add pending OT to confirmed OT", () => {
    const report = buildAttendanceReport(
      ["2026-10-18"],
      [
        fact({
          personnelId: "p1",
          status: "COMPLETE",
          otBefore: { minutes: 40, status: "PENDING" },
          otAfter: { minutes: 30, status: "OT" },
        }),
      ]
    )
    expect(report.cards.confirmedOtMinutes).toBe(30)
    expect(report.cards.pendingOtCount).toBe(1)
    expect(report.people[0]?.otBeforeMinutes).toBe(0)
    expect(report.people[0]?.otAfterMinutes).toBe(30)
  })

  it("counts leave reasons separately", () => {
    const report = buildAttendanceReport(
      ["2026-10-18", "2026-10-19"],
      [
        fact({ personnelId: "p1", status: "NO_SCAN", noteReason: "PERSONAL" }),
        fact({ personnelId: "p1", date: "2026-10-19", status: "COMPLETE", noteReason: "SICK" }),
        fact({ personnelId: "p2", displayName: "บี", status: "NO_SCAN", noteReason: "ABSENT" }),
      ]
    )
    expect(report.cards.leave).toMatchObject({ PERSONAL: 1, SICK: 1, ABSENT: 1, INTRA_DAY: 0 })
    expect(report.cards.presentPeople).toBe(1)
    expect(report.days[0]?.present).toBe(0)
    expect(report.days[1]?.present).toBe(1)
  })
})

describe("buildExceptionGroups", () => {
  it("omits an on-time day that has no note", () => {
    const groups = buildExceptionGroups([
      fact({ personnelId: "p1", status: "COMPLETE", manMinutes: 480, lateMinutes: 0 }),
    ])
    expect(groups).toEqual([])
  })

  it("lists a 12 minute late arrival and adds it to the day total", () => {
    const groups = buildExceptionGroups([
      fact({
        personnelId: "p1",
        displayName: "ต้น",
        status: "COMPLETE",
        lateMinutes: 12,
        firstIn: at("01:12"),
        lastOut: at("10:00"),
      }),
      fact({ personnelId: "p2", displayName: "เอ", status: "COMPLETE", lateMinutes: 1 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.minutes).toBe(13)
    expect(groups[0]?.rows.find((row) => row.displayName === "ต้น")).toMatchObject({ late: true, minutes: 12 })
    expect(groups[0]?.rows.find((row) => row.displayName === "เอ")).toMatchObject({ late: true, minutes: 1 })
  })

  it("hides today's forgot-scan rows and keeps late, leave, and notes", () => {
    const groups = buildExceptionGroups([
      fact({ personnelId: "p1", displayName: "ลืม", status: "SINGLE_PUNCH" }),
      fact({ personnelId: "p2", displayName: "สาย", status: "SINGLE_PUNCH", lateMinutes: 8 }),
      fact({ personnelId: "p3", displayName: "ลา", status: "NO_SCAN", noteReason: "SICK", note: "ลา" }),
      fact({ personnelId: "p4", displayName: "เมื่อวาน", date: "2026-10-17", status: "SINGLE_PUNCH" }),
    ])
    const visible = omitTodayOpenForgotScans(groups, "2026-10-18")
    const today = visible.find((group) => group.date === "2026-10-18")
    expect(today?.rows.map((row) => row.displayName)).toEqual(["ลา", "สาย"])
    expect(today?.minutes).toBe(8)
    expect(visible.find((group) => group.date === "2026-10-17")?.rows).toHaveLength(1)
  })

  it("counts an afternoon leave from 13:00 to 17:00 as 240 lost minutes", () => {
    const groups = buildExceptionGroups([
      fact({
        personnelId: "p1",
        displayName: "นีนี",
        status: "COMPLETE",
        noteReason: "INTRA_DAY",
        note: "ปวดหลัง ลา 13.00-17.00",
        firstIn: at("00:49"),
        lastOut: at("05:01"),
      }),
      fact({
        personnelId: "p2",
        displayName: "มาเดอร์แวร์",
        status: "COMPLETE",
        noteReason: "INTRA_DAY",
        note: "ไม่สบาย ลา 13.00-17.00",
        firstIn: at("00:57"),
        lastOut: at("05:01"),
      }),
    ])
    expect(groups[0]?.rows.map((row) => row.minutes)).toEqual([240, 240])
    expect(groups[0]?.minutes).toBe(480)
  })

  it("splits staffing by department and counts an afternoon leave as 240 lost minutes", () => {
    const cells = buildStaffingCells([
      fact({
        personnelId: "p1",
        departmentId: "d1",
        status: "COMPLETE",
        noteReason: "INTRA_DAY",
        firstIn: at("00:49"),
        lastOut: at("05:01"),
        manMinutes: 240,
      }),
      fact({
        personnelId: "p2",
        departmentId: "d1",
        status: "NO_SCAN",
        noteReason: "SICK",
      }),
      fact({
        personnelId: "p3",
        departmentId: "d2",
        status: "COMPLETE",
        lateMinutes: 12,
        firstIn: at("01:12"),
        lastOut: at("10:00"),
        manMinutes: 468,
      }),
    ])
    const production = cells.find((cell) => cell.departmentId === "d1")
    const other = cells.find((cell) => cell.departmentId === "d2")
    expect(production).toMatchObject({ total: 2, fullLeave: 1, intraLeave: 1, late: 0, lostMinutes: 240, manMinutes: 240 })
    expect(other).toMatchObject({ total: 1, fullLeave: 0, late: 1, lostMinutes: 12, manMinutes: 468 })
  })

  it("keeps a note-only row at 0 minutes", () => {
    const groups = buildExceptionGroups([
      fact({ personnelId: "p1", status: "COMPLETE", lateMinutes: 0, note: "ปวดหลัง" }),
    ])
    expect(groups[0]?.rows[0]).toMatchObject({ late: false, minutes: 0, note: "ปวดหลัง" })
    expect(groups[0]?.minutes).toBe(0)
  })

  it("carries the department id onto each row", () => {
    const groups = buildExceptionGroups([
      fact({ personnelId: "p1", departmentId: "d1", status: "NO_SCAN" }),
      fact({ personnelId: "p2", status: "NO_SCAN" }),
    ])
    expect(groups[0]?.rows.map((row) => row.departmentId)).toEqual(["d1", null])
  })

  it("includes a day with no scan", () => {
    const groups = buildExceptionGroups([
      fact({ personnelId: "p1", status: "NO_SCAN" }),
      fact({ personnelId: "p2", date: "2026-10-19", status: "NO_SCAN" }),
    ])
    expect(groups.map((group) => group.date)).toEqual(["2026-10-19", "2026-10-18"])
    expect(groups[1]?.rows[0]?.status).toBe("NO_SCAN")
    expect(groups[1]?.rows[0]?.minutes).toBe(0)
  })
})

describe("filterExceptionGroups", () => {
  const groups = buildExceptionGroups([
    fact({ personnelId: "p1", displayName: "ก", departmentId: "maid", status: "COMPLETE", lateMinutes: 5 }),
    fact({ personnelId: "p2", displayName: "ข", departmentId: "prod", status: "COMPLETE", lateMinutes: 7 }),
    fact({ personnelId: "p3", displayName: "ค", departmentId: null, status: "COMPLETE", lateMinutes: 11 }),
    fact({ personnelId: "p1", displayName: "ก", departmentId: "maid", date: "2026-10-19", status: "NO_SCAN" }),
  ])

  it("keeps everything when nothing is selected", () => {
    expect(filterExceptionGroups(groups, "only", new Set())).toBe(groups)
    expect(filterExceptionGroups(groups, "except", new Set())).toBe(groups)
  })

  it("shows only the selected departments and recomputes the day total", () => {
    const result = filterExceptionGroups(groups, "only", new Set(["prod", null]))
    expect(result.map((group) => group.date)).toEqual(["2026-10-18"])
    expect(result[0]?.rows.map((row) => row.personnelId)).toEqual(["p2", "p3"])
    expect(result[0]?.minutes).toBe(18)
  })

  it("hides the excepted departments and drops days left empty", () => {
    const result = filterExceptionGroups(groups, "except", new Set(["maid"]))
    expect(result.map((group) => group.date)).toEqual(["2026-10-18"])
    expect(result[0]?.rows.map((row) => row.personnelId)).toEqual(["p2", "p3"])
    expect(result[0]?.minutes).toBe(18)
  })
})

describe("dateKeysInRange", () => {
  it("rejects a range longer than 62 days", () => {
    expect(dateKeysInRange("2026-01-01", "2026-03-05")).toBeNull()
    expect(dateKeysInRange("2026-10-01", "2026-10-19")).toHaveLength(19)
  })
})
