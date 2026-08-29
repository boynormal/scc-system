import { describe, expect, it } from "vitest"
import {
  EXPENSE_STATUSES,
  EXPENSE_SOURCE_MODULES,
  EXPENSE_SOURCE_KINDS,
  EXPENSE_PRICING_MODES,
  EXPENSE_COST_OBJECT_TYPES,
  createExpenseSchema,
  expenseLineInputSchema,
  _computeNetForTests as computeNet,
  _assertLineDimensionsForTests as assertLineDimensions,
  _assertHeaderVendorForTests as assertHeaderVendor,
  type TypeDimensionMeta,
  type DimensionLookup,
} from "@/modules/finance/application/expense-service"

const CC_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CC_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const CC_OUT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const PROC_A = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const PROC_OUT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
const UNIT_L = "ffffffff-ffff-ffff-ffff-ffffffffffff"

function meta(over: Partial<TypeDimensionMeta> = {}): TypeDimensionMeta {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    requiresVendor: false,
    requiresVehicle: false,
    requiresMachine: false,
    requiresLocation: false,
    requiresCostCenter: false,
    requiresProcess: false,
    allowedCostCenterIds: [],
    defaultCostCenterId: null,
    allowedProcessIds: [],
    defaultProcessId: null,
    ...over,
  }
}

const lookup: DimensionLookup = {
  activeCostCenterIds: new Set([CC_A, CC_B]),
  activeProcessIds: new Set([PROC_A]),
  unitsById: new Map([[UNIT_L, { code: "L" }]]),
}

function line(
  over: Partial<{
    lineNo: number
    pricingMode: "QTY_PRICE" | "AMOUNT"
    costCenterId: string | null
    processId: string | null
    unitId: string | null
    costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null
    costObjectLabel: string | null
  }> = {}
) {
  return {
    lineNo: 1,
    pricingMode: "AMOUNT" as const,
    costCenterId: null,
    processId: null,
    unitId: null,
    costObjectType: null,
    costObjectLabel: null,
    ...over,
  }
}

describe("computeNet", () => {
  it("adds tax and subtracts discount", () => {
    expect(computeNet(1000, 70, 20)).toBe(1050)
  })

  it("never goes below zero", () => {
    expect(computeNet(100, 0, 500)).toBe(0)
  })

  it("rounds to 2 decimals", () => {
    expect(computeNet(10.005, 0, 0)).toBe(10.01)
  })
})

describe("expense enums", () => {
  it("contains the 6 lifecycle statuses", () => {
    expect(EXPENSE_STATUSES).toContain("DRAFT")
    expect(EXPENSE_STATUSES).toContain("PAID")
    expect(EXPENSE_STATUSES).toHaveLength(6)
  })

  it("no longer treats MANUAL/OTHER as a source module", () => {
    expect(EXPENSE_SOURCE_MODULES).not.toContain("MANUAL")
    expect(EXPENSE_SOURCE_MODULES).not.toContain("OTHER")
    expect(EXPENSE_SOURCE_MODULES).toContain("TRANSPORT")
  })

  it("exposes source kinds and pricing modes", () => {
    expect(EXPENSE_SOURCE_KINDS).toEqual(["MANUAL", "MODULE", "IMPORT"])
    expect(EXPENSE_PRICING_MODES).toEqual(["QTY_PRICE", "AMOUNT"])
  })
})

describe("createExpenseSchema", () => {
  it("requires a branch", () => {
    const bad = createExpenseSchema.safeParse({ lines: [] })
    expect(bad.success).toBe(false)
  })

  it("accepts a header with lines", () => {
    const ok = createExpenseSchema.safeParse({
      branchId: "11111111-1111-1111-1111-111111111111",
      expenseDate: "2026-08-27",
      lines: [
        {
          expenseTypeId: "22222222-2222-2222-2222-222222222222",
          pricingMode: "AMOUNT",
          amount: 3500,
        },
      ],
    })
    expect(ok.success).toBe(true)
  })

  it("accepts the expense form payload with nullable source fields", () => {
    const ok = createExpenseSchema.safeParse({
      branchId: "11111111-1111-1111-1111-111111111111",
      expenseDate: "2026-08-28",
      postingDate: "2026-08-28",
      vendorId: null,
      employeeId: null,
      paymentMethod: null,
      notes: null,
      status: "DRAFT",
      lines: [
        {
          expenseTypeId: "22222222-2222-2222-2222-222222222222",
          description: null,
          pricingMode: "QTY_PRICE",
          quantity: 2,
          unitCode: "L",
          unitPrice: 35,
          amount: 70,
          taxAmount: 0,
          discountAmount: 0,
          costCenterId: null,
          costObjectType: null,
          costObjectId: null,
          costObjectLabel: null,
          sourceKind: "MANUAL",
          sourceModule: null,
          sourceType: null,
          sourceDocumentId: null,
          sourceLineId: null,
        },
      ],
    })
    expect(ok.success).toBe(true)
  })

  it("still accepts a legacy flat body (wrapped into one line server-side)", () => {
    const ok = createExpenseSchema.safeParse({
      branchId: "11111111-1111-1111-1111-111111111111",
      expenseTypeId: "22222222-2222-2222-2222-222222222222",
      expenseDate: "2026-08-27",
      amount: 3500,
    })
    expect(ok.success).toBe(true)
  })
})

describe("expenseLineInputSchema", () => {
  it("requires an expense type", () => {
    const bad = expenseLineInputSchema.safeParse({ amount: 100 })
    expect(bad.success).toBe(false)
  })

  it("rejects a negative amount", () => {
    const bad = expenseLineInputSchema.safeParse({
      expenseTypeId: "22222222-2222-2222-2222-222222222222",
      amount: -5,
    })
    expect(bad.success).toBe(false)
  })

  it("accepts a QTY_PRICE line", () => {
    const ok = expenseLineInputSchema.safeParse({
      expenseTypeId: "22222222-2222-2222-2222-222222222222",
      pricingMode: "QTY_PRICE",
      quantity: 3,
      unitCode: "ลิตร",
      unitPrice: 32.5,
    })
    expect(ok.success).toBe(true)
  })

  it("round-trips processId, unitId, and LOCATION", () => {
    const ok = expenseLineInputSchema.safeParse({
      expenseTypeId: "22222222-2222-2222-2222-222222222222",
      processId: PROC_A,
      unitId: UNIT_L,
      unitCode: "L",
      costObjectType: "LOCATION",
      costObjectLabel: "ไซต์ A",
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.processId).toBe(PROC_A)
      expect(ok.data.unitId).toBe(UNIT_L)
      expect(ok.data.costObjectType).toBe("LOCATION")
    }
  })
})

describe("assertHeaderVendor", () => {
  it("rejects when any line type requires a vendor and header vendor is null", () => {
    expect(() => assertHeaderVendor([{ requiresVendor: true }], null)).toThrow("ต้องระบุผู้ขาย")
  })

  it("rejects mixed lines when only one type requires a vendor", () => {
    expect(() =>
      assertHeaderVendor([{ requiresVendor: false }, { requiresVendor: true }], null)
    ).toThrow("ต้องระบุผู้ขาย")
  })

  it("allows a missing vendor when no type requires one", () => {
    expect(() => assertHeaderVendor([{ requiresVendor: false }], null)).not.toThrow()
  })

  it("allows a vendor when required", () => {
    expect(() => assertHeaderVendor([{ requiresVendor: true }], CC_A)).not.toThrow()
  })
})

describe("assertLineDimensions", () => {
  it("requires a cost center when the type says so", () => {
    expect(() =>
      assertLineDimensions(line({}), meta({ requiresCostCenter: true }), lookup)
    ).toThrow("ต้องระบุหน่วยงานต้นทุน")
  })

  it("fills an empty cost center from the type default", () => {
    const out = assertLineDimensions(
      line({}),
      meta({ requiresCostCenter: true, allowedCostCenterIds: [CC_A], defaultCostCenterId: CC_A }),
      lookup
    )
    expect(out.costCenterId).toBe(CC_A)
  })

  it("rejects a cost center outside the allowlist", () => {
    expect(() =>
      assertLineDimensions(
        line({ costCenterId: CC_B }),
        meta({ allowedCostCenterIds: [CC_A] }),
        lookup
      )
    ).toThrow("หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต")
  })

  it("requires a process when the type says so", () => {
    expect(() =>
      assertLineDimensions(line({}), meta({ requiresProcess: true }), lookup)
    ).toThrow("ต้องระบุกระบวนการ")
  })

  it("rejects a process outside the allowlist", () => {
    expect(() =>
      assertLineDimensions(
        line({ processId: PROC_OUT }),
        meta({ allowedProcessIds: [PROC_A] }),
        lookup
      )
    ).toThrow("กระบวนการไม่อยู่ในรายการที่อนุญาต")
  })

  it("allows any active company cost center when the type has no maps", () => {
    const out = assertLineDimensions(line({ costCenterId: CC_B }), meta(), lookup)
    expect(out.costCenterId).toBe(CC_B)
  })

  it("rejects an inactive / unknown cost center when unrestricted", () => {
    expect(() =>
      assertLineDimensions(line({ costCenterId: CC_OUT }), meta(), lookup)
    ).toThrow("หน่วยงานต้นทุนไม่ถูกต้อง")
  })

  it("requires VEHICLE + label when requiresVehicle", () => {
    expect(() =>
      assertLineDimensions(line({ costObjectType: "MACHINE", costObjectLabel: "X" }), meta({ requiresVehicle: true }), lookup)
    ).toThrow("ประเภทวัตถุต้นทุนต้องเป็นรถ")
    expect(() =>
      assertLineDimensions(line({ costObjectType: "VEHICLE", costObjectLabel: "  " }), meta({ requiresVehicle: true }), lookup)
    ).toThrow("ต้องระบุรถ")
    const ok = assertLineDimensions(
      line({ costObjectType: "VEHICLE", costObjectLabel: "70-1234" }),
      meta({ requiresVehicle: true }),
      lookup
    )
    expect(ok.costObjectType).toBe("VEHICLE")
  })

  it("requires MACHINE + label when requiresMachine", () => {
    expect(() =>
      assertLineDimensions(line({ costObjectType: "VEHICLE", costObjectLabel: "X" }), meta({ requiresMachine: true }), lookup)
    ).toThrow("ประเภทวัตถุต้นทุนต้องเป็นเครื่องจักร")
    expect(() =>
      assertLineDimensions(line({ costObjectType: "MACHINE" }), meta({ requiresMachine: true }), lookup)
    ).toThrow("ต้องระบุเครื่องจักร")
  })

  it("requires LOCATION + label when requiresLocation", () => {
    expect(() =>
      assertLineDimensions(line({ costObjectType: "OTHER", costObjectLabel: "ไซต์" }), meta({ requiresLocation: true }), lookup)
    ).toThrow("ประเภทวัตถุต้นทุนต้องเป็นสถานที่")
    const ok = assertLineDimensions(
      line({ costObjectType: "LOCATION", costObjectLabel: "คลัง A" }),
      meta({ requiresLocation: true }),
      lookup
    )
    expect(ok.costObjectType).toBe("LOCATION")
    expect(ok.costObjectLabel).toBe("คลัง A")
  })

  it("requires unitId on QTY_PRICE and copies Unit.code", () => {
    expect(() =>
      assertLineDimensions(line({ pricingMode: "QTY_PRICE" }), meta(), lookup)
    ).toThrow("ต้องเลือกหน่วย")
    expect(() =>
      assertLineDimensions(line({ pricingMode: "QTY_PRICE", unitId: CC_A }), meta(), lookup)
    ).toThrow("หน่วยไม่ถูกต้อง")
    const ok = assertLineDimensions(line({ pricingMode: "QTY_PRICE", unitId: UNIT_L }), meta(), lookup)
    expect(ok.unitId).toBe(UNIT_L)
    expect(ok.unitCode).toBe("L")
  })

  it("clears unit on AMOUNT even if a unitId is sent", () => {
    const ok = assertLineDimensions(line({ pricingMode: "AMOUNT", unitId: UNIT_L }), meta(), lookup)
    expect(ok.unitId).toBeNull()
    expect(ok.unitCode).toBeNull()
  })

  it("keeps legacy types unrestricted (no requires, no maps)", () => {
    const out = assertLineDimensions(line({}), meta(), lookup)
    expect(out.costCenterId).toBeNull()
    expect(out.processId).toBeNull()
    expect(out.costObjectType).toBeNull()
  })
})

describe("cost object enum", () => {
  it("includes LOCATION", () => {
    expect(EXPENSE_COST_OBJECT_TYPES).toContain("LOCATION")
  })
})
