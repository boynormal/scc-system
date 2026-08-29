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
const PROC_TRANSPORT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const PROC_MAINT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
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
    processId: null,
    processName: null,
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
        processId: PROC_TRANSPORT,
        processName: "ขนส่ง",
      }),
      line({
        expenseTypeId: TOLL,
        expenseTypeCode: "EXP-0202",
        expenseTypeName: "ค่าทางด่วน",
        netAmount: 1000,
        processId: PROC_TRANSPORT,
        processName: "ขนส่ง",
      }),
      line({
        expenseTypeId: REPAIR,
        expenseTypeCode: "EXP-0602",
        expenseTypeName: "ค่าซ่อมรถ",
        netAmount: 2000,
        processId: PROC_MAINT,
        processName: "ซ่อมบำรุง",
      }),
    ],
  }
}

describe("expenseReportQuerySchema", () => {
  it("accepts processId=none and sourceModule=MANUAL", () => {
    const ok = expenseReportQuerySchema.safeParse({
      processId: "none",
      sourceModule: "MANUAL",
      status: "APPROVED",
    })
    expect(ok.success).toBe(true)
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

  it("3. by Process split", () => {
    const out = aggregateExpenseReport([billA()])
    const byId = Object.fromEntries(out.byProcess.map((b) => [b.key, b]))
    expect(byId[PROC_TRANSPORT].total).toBe(6000)
    expect(byId[PROC_TRANSPORT].label).toBe("ขนส่ง")
    expect(byId[PROC_MAINT].total).toBe(2000)
  })

  it("4. Process × ExpenseType matrix equals line sums", () => {
    const out = aggregateExpenseReport([billA()])
    expect(out.matrix.cells[PROC_TRANSPORT][FUEL]).toBe(5000)
    expect(out.matrix.cells[PROC_TRANSPORT][TOLL]).toBe(1000)
    expect(out.matrix.cells[PROC_TRANSPORT][REPAIR]).toBe(0)
    expect(out.matrix.cells[PROC_MAINT][REPAIR]).toBe(2000)
    expect(out.matrix.cells[PROC_MAINT][FUEL]).toBe(0)
  })

  it("5. NULL process is labeled ไม่ระบุ Process and stays in grandTotal", () => {
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
          processId: null,
          costCenterId: null,
          costObjectType: null,
        }),
      ],
    }
    const out = aggregateExpenseReport([historical])
    expect(out.grandTotal).toBe(250)
    expect(out.byProcess[0].key).toBe("none")
    expect(out.byProcess[0].label).toBe("ไม่ระบุ Process")
    expect(out.byCostCenter[0].label).toBe("ไม่ระบุหน่วยงาน")
    expect(out.byCostObject[0].label).toBe("ไม่ระบุ")
    expect(out.byModule[0].key).toBe("MANUAL")
  })

  it("6. Process=Transport filter: total 6000, bills 1, lines 2; type and matrix follow", () => {
    const out = aggregateExpenseReport([billA()], { processId: PROC_TRANSPORT })
    expect(out.grandTotal).toBe(6000)
    expect(out.count).toBe(1)
    expect(out.lineCount).toBe(2)
    expect(out.byType.map((b) => b.key).sort()).toEqual([FUEL, TOLL].sort())
    expect(out.byType.find((b) => b.key === REPAIR)).toBeUndefined()
    expect(out.matrix.processes.map((p) => p.key)).toEqual([PROC_TRANSPORT])
    expect(out.matrix.cells[PROC_TRANSPORT][FUEL]).toBe(5000)
    expect(out.matrix.cells[PROC_TRANSPORT][TOLL]).toBe(1000)
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
              processId: null,
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
    processId: PROC_TRANSPORT,
    sourceModule: null,
  })

  it("processId=none matches only null process", () => {
    expect(lineMatchesFilters(sample, { processId: "none" })).toBe(false)
    expect(lineMatchesFilters({ ...sample, processId: null }, { processId: "none" })).toBe(true)
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
