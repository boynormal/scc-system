import { describe, expect, it } from "vitest"
import type { UserRole } from "@/lib/permissions"
import {
  expenseReportQuerySchema,
  _aggregateExpenseReportForTests as aggregateExpenseReport,
  _reportWhereForTests as reportWhere,
  _lineMatchesFiltersForTests as lineMatchesFilters,
  type ReportRowInput,
} from "@/modules/finance/application/expense-reports-service"

const BRANCH_A = "11111111-1111-1111-1111-111111111111"
const BRANCH_B = "12222222-2222-2222-2222-222222222222"
const FUEL = "22222222-2222-2222-2222-222222222222"
const TOLL = "23333333-3333-3333-3333-333333333333"
const REPAIR = "24444444-4444-4444-4444-444444444444"
const CC_TRANSPORT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CC_MAINT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const BILL_A = "99999999-9999-9999-9999-999999999999"

const adminRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Admin", permissions: null },
]
const viewerRoles: UserRole[] = [
  { branchId: BRANCH_A, branchName: "HQ", roleName: "Viewer", permissions: { expenses: ["read"] } },
]

function line(over: Partial<ReportRowInput["lines"][number]> & Pick<ReportRowInput["lines"][number], "expenseTypeId" | "expenseTypeName" | "netAmount">): ReportRowInput["lines"][number] {
  return {
    sourceModule: null,
    costCenterId: null,
    costCenterName: null,
    expenseTypeCode: null,
    costObjectType: null,
    costObjectId: null,
    costObjectLabel: null,
    ...over,
  }
}

function billA(): ReportRowInput {
  return {
    id: BILL_A,
    branchId: BRANCH_A,
    branchName: "สำนักงานใหญ่",
    expenseDate: new Date("2026-08-01T00:00:00.000Z"),
    vendorId: null,
    lines: [
      line({
        expenseTypeId: FUEL,
        expenseTypeCode: "EXP-0301",
        expenseTypeName: "น้ำมันเชื้อเพลิง",
        netAmount: 5000,
        costCenterId: CC_TRANSPORT,
        costCenterName: "ขนส่ง",
      }),
      line({
        expenseTypeId: TOLL,
        expenseTypeCode: "EXP-0202",
        expenseTypeName: "ค่าทางด่วน",
        netAmount: 1000,
        costCenterId: CC_TRANSPORT,
        costCenterName: "ขนส่ง",
      }),
      line({
        expenseTypeId: REPAIR,
        expenseTypeCode: "EXP-0602",
        expenseTypeName: "ค่าซ่อมรถ",
        netAmount: 2000,
        costCenterId: CC_MAINT,
        costCenterName: "ซ่อมบำรุง",
      }),
    ],
  }
}

describe("expenseReportQuerySchema", () => {
  it("accepts sourceModule=MANUAL and drops a legacy processId", () => {
    const ok = expenseReportQuerySchema.safeParse({
      processId: "none",
      sourceModule: "MANUAL",
      status: "APPROVED",
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data).not.toHaveProperty("processId")
  })
})

describe("Expense Reporting MVP", () => {
  it("1. multi-line bill: total 8000, billCount 1, lineCount 3", () => {
    const out = aggregateExpenseReport([billA()])
    expect(out.grandTotal).toBe(8000)
    expect(out.count).toBe(1)
    expect(out.lineCount).toBe(3)
    expect(out.avgPerBill).toBe(8000)
    expect(out.avgPerLine).toBeCloseTo(2666.67, 1)
  })

  it("2. by ExpenseType split", () => {
    const out = aggregateExpenseReport([billA()])
    const byId = Object.fromEntries(out.byType.map((b) => [b.key, b]))
    expect(byId[FUEL].total).toBe(5000)
    expect(byId[FUEL].label).toBe("EXP-0301 · น้ำมันเชื้อเพลิง")
    expect(byId[TOLL].total).toBe(1000)
    expect(byId[REPAIR].total).toBe(2000)
    expect(byId[FUEL].count).toBe(1)
  })

  it("3. by cost center split", () => {
    const out = aggregateExpenseReport([billA()])
    const byId = Object.fromEntries(out.byCostCenter.map((b) => [b.key, b]))
    expect(byId[CC_TRANSPORT].total).toBe(6000)
    expect(byId[CC_TRANSPORT].label).toBe("ขนส่ง")
    expect(byId[CC_MAINT].total).toBe(2000)
  })

  it("4. the report has no process buckets or process matrix", () => {
    const out = aggregateExpenseReport([billA()])
    expect(out).not.toHaveProperty("byProcess")
    expect(out).not.toHaveProperty("matrix")
  })

  it("5. NULL dimensions are labeled and stay in grandTotal", () => {
    const historical: ReportRowInput = {
      id: "88888888-8888-8888-8888-888888888888",
      branchId: BRANCH_A,
      branchName: "HQ",
      expenseDate: new Date("2026-07-01T00:00:00.000Z"),
      lines: [
        line({
          expenseTypeId: FUEL,
          expenseTypeCode: "OTHER",
          expenseTypeName: "อื่นๆ",
          netAmount: 250,
          costCenterId: null,
          costObjectType: null,
        }),
      ],
    }
    const out = aggregateExpenseReport([historical])
    expect(out.grandTotal).toBe(250)
    expect(out.byCostCenter[0].key).toBe("none")
    expect(out.byCostCenter[0].label).toBe("ไม่ระบุหน่วยงาน")
    expect(out.byCostObject[0].label).toBe("ไม่ระบุ")
    expect(out.byModule[0].key).toBe("MANUAL")
  })

  it("6. cost center filter: total 6000, bills 1, lines 2; type totals follow", () => {
    const out = aggregateExpenseReport([billA()], { costCenterId: CC_TRANSPORT })
    expect(out.grandTotal).toBe(6000)
    expect(out.count).toBe(1)
    expect(out.lineCount).toBe(2)
    expect(out.byType.map((b) => b.key).sort()).toEqual([FUEL, TOLL].sort())
    expect(out.byType.find((b) => b.key === REPAIR)).toBeUndefined()
    expect(Object.fromEntries(out.byType.map((b) => [b.key, b.total]))).toEqual({ [FUEL]: 5000, [TOLL]: 1000 })
  })

  it("7. no double counting: billCount is 1, total is line sum not header+lines", () => {
    const out = aggregateExpenseReport([billA()])
    expect(out.count).not.toBe(3)
    expect(out.count).toBe(1)
    expect(out.grandTotal).toBe(8000)
    expect(out.grandTotal).not.toBe(16000)
    expect(out.byBranch[0].total).toBe(8000)
  })

  it("8. historical NULL dimensions do not throw", () => {
    expect(() =>
      aggregateExpenseReport([
        {
          id: BILL_A,
          branchId: BRANCH_A,
          branchName: "HQ",
          expenseDate: "2026-01-15T00:00:00.000Z",
          lines: [
            line({
              expenseTypeId: FUEL,
              expenseTypeName: "น้ำมันเชื้อเพลิง",
              netAmount: 10,
              costCenterId: null,
              costObjectType: null,
              costObjectId: null,
              costObjectLabel: null,
              sourceModule: null,
            }),
          ],
        },
      ])
    ).not.toThrow()
  })

  it("zero-safe averages when empty", () => {
    const out = aggregateExpenseReport([])
    expect(out.avgPerBill).toBe(0)
    expect(out.avgPerLine).toBe(0)
    expect(out.grandTotal).toBe(0)
  })
})

describe("lineMatchesFilters", () => {
  const sample = line({
    expenseTypeId: FUEL,
    expenseTypeName: "น้ำมัน",
    netAmount: 1,
    costCenterId: CC_TRANSPORT,
    sourceModule: null,
  })

  it("costCenterId matches only that cost center", () => {
    expect(lineMatchesFilters(sample, { costCenterId: CC_TRANSPORT })).toBe(true)
    expect(lineMatchesFilters(sample, { costCenterId: CC_MAINT })).toBe(false)
  })

  it("sourceModule=MANUAL matches only null module", () => {
    expect(lineMatchesFilters(sample, { sourceModule: "MANUAL" })).toBe(true)
    expect(lineMatchesFilters({ ...sample, sourceModule: "TRANSPORT" }, { sourceModule: "MANUAL" })).toBe(false)
  })
})

describe("reportWhere", () => {
  it("9. excludes soft-deleted and CANCELLED/REJECTED", () => {
    const where = reportWhere("cc", adminRoles)
    expect(where.deletedAt).toBeNull()
    expect(where.status).toEqual({ notIn: ["CANCELLED", "REJECTED"] })
    expect(where.companyId).toBe("cc")
  })

  it("10. non-admin cannot read another branch", () => {
    const blocked = reportWhere("cc", viewerRoles, BRANCH_B)
    expect(blocked).toEqual({ id: "00000000-0000-0000-0000-000000000000" })
    const allowed = reportWhere("cc", viewerRoles, BRANCH_A)
    expect(allowed.branchId).toBe(BRANCH_A)
    const scoped = reportWhere("cc", viewerRoles)
    expect(scoped.branchId).toEqual({ in: [BRANCH_A] })
  })
})
