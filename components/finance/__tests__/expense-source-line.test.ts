import { describe, expect, it } from "vitest"
import { sourceToLine } from "../expense-source-line"
import type { ExpenseSourceRow } from "../expense-types"

function row(over: Partial<ExpenseSourceRow> = {}): ExpenseSourceRow {
  return {
    sourceType: "TRANSPORT_JOB",
    sourceId: "job-1",
    sourceKind: "IMPORT",
    sourceModule: "TRANSPORT",
    sourceDocumentId: "job-1",
    sourceLineId: null,
    branchId: "b1",
    branchName: "HQ",
    date: "2026-08-03T00:00:00.000Z",
    vehicleId: "v1",
    vehicleLabel: "กข-1234",
    assetId: null,
    assetLabel: null,
    amount: null,
    paymentMethod: null,
    documentNo: "TJ-2026-00001",
    description: null,
    suggestedCostObjectType: "JOB",
    groupKey: "g",
    groupLabel: "g",
    ...over,
  }
}

describe("sourceToLine", () => {
  it("preselects the vehicle's asset", () => {
    const line = sourceToLine(row({ assetId: "a1", assetLabel: "AST-001 — รถบรรทุก" }))
    expect(line.costObjectType).toBe("VEHICLE")
    expect(line.costObjectId).toBe("a1")
    expect(line.costObjectLabel).toBe("AST-001 — รถบรรทุก")
    expect(line.sourceDocumentId).toBe("job-1")
    expect(line.sourceType).toBe("TRANSPORT_JOB")
  })

  it("leaves the asset empty and never uses the job or vehicle id", () => {
    for (const sourceType of ["TRANSPORT_JOB", "TRANSPORT_REPAIR", "TRANSPORT_TIRE"] as const) {
      const line = sourceToLine(row({ sourceType }))
      expect(line.costObjectType).toBe("")
      expect(line.costObjectId).toBe("")
      expect(line.costObjectLabel).toBe("")
      expect(line.sourceDocumentId).toBe("job-1")
    }
  })
})
