import { describe, expect, it } from "vitest"
import { sourceToLine, sourceToLines } from "../expense-source-line"
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

describe("sourceToLines", () => {
  const po = row({
    sourceType: "PURCHASE_ORDER",
    sourceModule: "PROCUREMENT",
    sourceId: "po-1",
    sourceDocumentId: "po-1",
    vehicleId: "",
    vehicleLabel: "-",
    amount: 1150,
    suggestedCostObjectType: null,
    supplierId: "s1",
    supplierName: "ร้านอะไหล่",
    lines: [
      {
        id: "l1",
        description: "ผ้าเบรก",
        quantity: 2,
        unitId: "u1",
        unitCode: "SET",
        unitPrice: 500,
        amount: 1000,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-1234",
      },
      {
        id: "l2",
        description: "ค่าส่ง",
        quantity: 1,
        unitId: null,
        unitCode: null,
        unitPrice: 150,
        amount: 150,
        costObjectType: "ASSET",
        costObjectLabel: "AST-9",
      },
    ],
  })

  it("keeps a transport row as a single line", () => {
    expect(sourceToLines(row())).toHaveLength(1)
  })

  it("turns each PO line into a linked bill line with no expense type", () => {
    const lines = sourceToLines(po)
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.sourceLineId)).toEqual(["l1", "l2"])
    for (const l of lines) {
      expect(l.sourceModule).toBe("PROCUREMENT")
      expect(l.sourceType).toBe("PURCHASE_ORDER")
      expect(l.sourceDocumentId).toBe("po-1")
      expect(l.expenseTypeId).toBe("")
    }
    expect(lines[0]).toMatchObject({ pricingMode: "QTY_PRICE", quantity: "2", unitId: "u1", unitPrice: "500" })
    expect(lines[0]).toMatchObject({ costObjectType: "", costObjectLabel: "", costObjectId: "" })
    expect(lines[1]).toMatchObject({ pricingMode: "AMOUNT", amount: "150", costObjectType: "" })
  })
})
