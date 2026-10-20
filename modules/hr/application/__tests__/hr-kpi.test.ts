import { describe, expect, it } from "vitest"
import { buildHireLeaveTrend, buildTurnoverKpi, buildWorkforceKpi, employedAt, type WorkforcePerson } from "@/modules/hr/application/hr-kpi"

function person(partial: Partial<WorkforcePerson> & Pick<WorkforcePerson, "id">): WorkforcePerson {
  return {
    branchId: "b1",
    branchName: "สำนักงาน",
    departmentName: "ผลิต",
    birthDate: null,
    startDate: null,
    endDate: null,
    gender: null,
    exitKind: null,
    isActive: true,
    ...partial,
  }
}

describe("workforce kpi", () => {
  const people = [
    person({ id: "a", birthDate: "1990-01-01", startDate: "2020-01-01", gender: "MALE" }),
    person({ id: "b", birthDate: "2000-06-01", startDate: "2024-01-01", gender: "FEMALE", departmentName: "บัญชี" }),
    person({ id: "c", isActive: true }),
    person({ id: "d", startDate: "2010-01-01", endDate: "2026-09-01", exitKind: "VOLUNTARY", isActive: false }),
  ]

  it("counts people who have started and have not left", () => {
    expect(employedAt(people[3]!, "2026-10-31")).toBe(false)
    const kpi = buildWorkforceKpi(people, "2026-10-31")
    expect(kpi.headcount).toBe(3)
    expect(kpi.gender).toEqual({ male: 1, female: 1, unspecified: 1 })
    expect(kpi.averageAgeYears).not.toBeNull()
    expect(kpi.ageBands.unknown).toBe(1)
  })

  it("counts nationality and leaves missing values as unknown", () => {
    const kpi = buildWorkforceKpi(
      [
        person({ id: "th", nationality: "THAI" }),
        person({ id: "mm1", nationality: "MYANMAR" }),
        person({ id: "mm2", nationality: "MYANMAR" }),
        person({ id: "x", nationality: "OTHER" }),
        person({ id: "none" }),
      ],
      "2026-10-31"
    )
    expect(kpi.nationality).toEqual({ thai: 1, myanmar: 2, other: 1, unknown: 1 })
  })

  it("counts hires, voluntary leavers, and retention", () => {
    const monthPeople = [
      person({ id: "stay", startDate: "2020-01-01" }),
      person({ id: "hire", startDate: "2026-10-05", gender: "FEMALE" }),
      person({ id: "quit", startDate: "2019-01-01", endDate: "2026-10-15", exitKind: "VOLUNTARY", isActive: false }),
      person({ id: "fired", startDate: "2018-01-01", endDate: "2026-10-20", exitKind: "INVOLUNTARY", isActive: false }),
    ]
    const kpi = buildTurnoverKpi(monthPeople, "2026-10-01", "2026-10-31")
    expect(kpi.hires).toBe(1)
    expect(kpi.leavers).toBe(2)
    expect(kpi.voluntaryLeavers).toBe(1)
    expect(kpi.retentionRate).toBe(33.3)
  })

  it("returns six months of hires and leavers ending at the selected month", () => {
    const trend = buildHireLeaveTrend(
      [
        person({ id: "hire", startDate: "2026-10-05" }),
        person({ id: "quit", startDate: "2019-01-01", endDate: "2026-08-02", isActive: false }),
      ],
      "2026-10",
      "2026-10-20"
    )
    expect(trend).toHaveLength(6)
    expect(trend[5]).toMatchObject({ month: "2026-10", hires: 1, leavers: 0 })
    expect(trend.find((point) => point.month === "2026-08")).toMatchObject({ hires: 0, leavers: 1 })
  })
})
