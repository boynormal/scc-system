/**
 * Executable acceptance cases for Expense Phase 4 (CLOSED 8/8, 2026-08-29).
 * Evidence: modules/finance/EXPENSE-PHASE-4-ACCEPTANCE.md
 */
import { describe, expect, it } from "vitest"
import {
  _assertHeaderVendorForTests as assertHeaderVendor,
  _assertLineDimensionsForTests as assertLineDimensions,
  expenseLineInputSchema,
  type DimensionLookup,
  type TypeDimensionMeta,
} from "@/modules/finance/application/expense-service"
import {
  anyLineRequiresVendor,
  applyTypeChange,
  costCenterOptions,
  prefillSourceCostCenter,
  transportCostCenterId,
  validateExpenseForm,
  validateLineDraft,
} from "@/components/finance/expense-form-validation"
import type { CostCenterRow, ExpenseTypeOption, LineDraft } from "@/components/finance/expense-types"

const CC_TRANSPORT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CC_MAINT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const UNIT_L = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
const VENDOR = "ffffffff-ffff-ffff-ffff-ffffffffffff"
const BRANCH = "11111111-1111-1111-1111-111111111111"
const OTHER_ID = "21111111-1111-1111-1111-111111111111"
const FUEL_ID = "22222222-2222-2222-2222-222222222222"
const REPAIR_ID = "23333333-3333-3333-3333-333333333333"
const TOLL_ID = "24444444-4444-4444-4444-444444444444"
const WATER_ID = "25555555-5555-5555-5555-555555555555"

function typeOpt(over: Partial<ExpenseTypeOption> & Pick<ExpenseTypeOption, "id" | "code" | "name">): ExpenseTypeOption {
  return {
    subcategory: null,
    description: null,
    categoryId: null,
    categoryName: null,
    transactionType: "EXPENSE",
    defaultCostType: null,
    defaultDirectness: null,
    defaultGlLabel: null,
    requiresVendor: false,
    requiresVehicle: false,
    requiresMachine: false,
    requiresLocation: false,
    requiresCostCenter: false,
    isActive: true,
    costCenterCount: 0,
    allowedCostCenterIds: [],
    defaultCostCenterId: null,
    ...over,
  }
}

const other = typeOpt({ id: OTHER_ID, code: "OTHER", name: "อื่นๆ" })
const fuel = typeOpt({
  id: FUEL_ID,
  code: "EXP-0301",
  name: "น้ำมันเชื้อเพลิง",
  requiresVendor: true,
  requiresVehicle: true,
  requiresCostCenter: true,
  allowedCostCenterIds: [CC_TRANSPORT],
  defaultCostCenterId: CC_TRANSPORT,
})
const repair = typeOpt({
  id: REPAIR_ID,
  code: "EXP-0602",
  name: "ค่าซ่อมรถ",
  requiresVendor: true,
  requiresVehicle: true,
  requiresCostCenter: true,
  allowedCostCenterIds: [CC_TRANSPORT],
  defaultCostCenterId: CC_TRANSPORT,
})
const toll = typeOpt({
  id: TOLL_ID,
  code: "EXP-0202",
  name: "ค่าทางด่วน",
  requiresVehicle: true,
  requiresCostCenter: true,
})
const water = typeOpt({
  id: WATER_ID,
  code: "EXP-0401",
  name: "ค่าน้ำ",
  requiresVendor: true,
  requiresLocation: true,
  requiresCostCenter: true,
})

const types = [other, fuel, repair, toll, water]

const costCenters: CostCenterRow[] = [
  { id: CC_TRANSPORT, code: "TRANSPORT", name: "ขนส่ง", branchId: BRANCH, branchName: "HQ", parentId: null, parentName: null, isActive: true },
  { id: CC_MAINT, code: "MAINTENANCE", name: "ซ่อมบำรุง", branchId: BRANCH, branchName: "HQ", parentId: null, parentName: null, isActive: true },
]

function draft(over: Partial<LineDraft> & { expenseTypeId: string }): LineDraft {
  return {
    key: "k1",
    description: "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: "",
    amount: "100",
    taxAmount: "",
    taxMode: "NONE",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    costObjectType: "",
    costObjectId: "",
    costObjectLabel: "",
    sourceKind: "MANUAL",
    sourceModule: null,
    sourceType: null,
    sourceDocumentId: null,
    sourceLineId: null,
    ...over,
  }
}

function fuelMeta(): TypeDimensionMeta {
  return {
    id: FUEL_ID,
    requiresVendor: true,
    requiresVehicle: true,
    requiresMachine: false,
    requiresLocation: false,
    requiresCostCenter: true,
    allowedCostCenterIds: [CC_TRANSPORT],
    defaultCostCenterId: CC_TRANSPORT,
  }
}

const lookup: DimensionLookup = {
  activeCostCenterIds: new Set([CC_TRANSPORT, CC_MAINT]),
  unitsById: new Map([[UNIT_L, { code: "L" }]]),
}

describe("Expense Phase 4 acceptance (8/8)", () => {
  it("1. unrestricted type saves without vendor / CC", () => {
    const line = draft({ expenseTypeId: OTHER_ID, amount: "250" })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: "", lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      { lineNo: 1, pricingMode: "AMOUNT", costCenterId: null, unitId: null, costObjectType: null, costObjectLabel: null },
      {
        id: OTHER_ID,
        requiresVendor: false,
        requiresVehicle: false,
        requiresMachine: false,
        requiresLocation: false,
        requiresCostCenter: false,
        allowedCostCenterIds: [],
        defaultCostCenterId: null,
      },
      lookup
    )
    expect(out.costCenterId).toBeNull()
    expect(() => assertHeaderVendor([{ requiresVendor: false }], null)).not.toThrow()
  })

  it("2. fuel requires vendor + default CC + vehicle + unit L", () => {
    const line = draft({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      quantity: "10",
      unitId: UNIT_L,
      unitCode: "L",
      unitPrice: "35",
      amount: "350",
      costCenterId: CC_TRANSPORT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-1234",
    })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: VENDOR, lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "QTY_PRICE",
        costCenterId: null,
        unitId: UNIT_L,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-1234",
      },
      fuelMeta(),
      lookup
    )
    expect(out.costCenterId).toBe(CC_TRANSPORT)
    expect(out.unitId).toBe(UNIT_L)
    expect(out.unitCode).toBe("L")
    expect(out.costObjectType).toBe("VEHICLE")
    expect(() => assertHeaderVendor([{ requiresVendor: true }], VENDOR)).not.toThrow()
  })

  it("3. fuel without a vehicle is allowed", () => {
    const line = draft({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      unitId: UNIT_L,
      costCenterId: CC_TRANSPORT,
      costObjectType: "VEHICLE",
      costObjectLabel: "",
    })
    expect(validateLineDraft(line, fuel)).toBeNull()
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "QTY_PRICE",
        costCenterId: CC_TRANSPORT,
        unitId: UNIT_L,
        costObjectType: "VEHICLE",
        costObjectLabel: "  ",
      },
      fuelMeta(),
      lookup
    )
    expect(out.costObjectLabel).toBeNull()
  })

  it("4. allowlist — UI hides blocked CC; server rejects if forced", () => {
    const shown = costCenterOptions(fuel, costCenters, "")
    expect(shown.map((c) => c.id)).toEqual([CC_TRANSPORT])
    expect(shown.some((c) => c.id === CC_MAINT)).toBe(false)
    const forced = draft({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      unitId: UNIT_L,
      costCenterId: CC_MAINT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-1234",
    })
    expect(validateLineDraft(forced, fuel)).toBe("หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต")
    expect(() =>
      assertLineDimensions(
        {
          lineNo: 1,
          pricingMode: "QTY_PRICE",
          costCenterId: CC_MAINT,
          unitId: UNIT_L,
          costObjectType: "VEHICLE",
          costObjectLabel: "70-1234",
        },
        fuelMeta(),
        lookup
      )
    ).toThrow("หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต")
  })

  it("5. no maps — every active company CC is selectable", () => {
    expect(costCenterOptions(toll, costCenters, "").map((c) => c.id)).toEqual([CC_TRANSPORT, CC_MAINT])
    const line = draft({
      expenseTypeId: TOLL_ID,
      costCenterId: CC_MAINT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-9999",
    })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: "", lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "AMOUNT",
        costCenterId: CC_MAINT,
        unitId: null,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-9999",
      },
      {
        id: TOLL_ID,
        requiresVendor: false,
        requiresVehicle: true,
        requiresMachine: false,
        requiresLocation: false,
        requiresCostCenter: true,
        allowedCostCenterIds: [],
        defaultCostCenterId: null,
      },
      lookup
    )
    expect(out.costCenterId).toBe(CC_MAINT)
  })

  it("6. requiresLocation — type LOCATION + label required", () => {
    const empty = draft({
      expenseTypeId: WATER_ID,
      costCenterId: CC_TRANSPORT,
      costObjectType: "LOCATION",
      costObjectLabel: "",
    })
    expect(validateLineDraft(empty, water)).toBe("ต้องระบุสถานที่")
    expect(() =>
      assertLineDimensions(
        {
          lineNo: 1,
          pricingMode: "AMOUNT",
          costCenterId: CC_TRANSPORT,
          unitId: null,
          costObjectType: "OTHER",
          costObjectLabel: "คลัง A",
        },
        {
          id: WATER_ID,
          requiresVendor: true,
          requiresVehicle: false,
          requiresMachine: false,
          requiresLocation: true,
          requiresCostCenter: true,
          allowedCostCenterIds: [],
          defaultCostCenterId: null,
        },
        lookup
      )
    ).toThrow("ประเภทวัตถุต้นทุนต้องเป็นสถานที่")
    const ok = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "AMOUNT",
        costCenterId: CC_TRANSPORT,
        unitId: null,
        costObjectType: "LOCATION",
        costObjectLabel: "คลัง A",
      },
      {
        id: WATER_ID,
        requiresVendor: true,
        requiresVehicle: false,
        requiresMachine: false,
        requiresLocation: true,
        requiresCostCenter: true,
        allowedCostCenterIds: [],
        defaultCostCenterId: null,
      },
      lookup
    )
    expect(ok.costObjectType).toBe("LOCATION")
    expect(ok.costObjectLabel).toBe("คลัง A")
  })

  it("7. mixed lines — header vendor required if any line requires it", () => {
    const lines = [
      draft({
        expenseTypeId: FUEL_ID,
        pricingMode: "QTY_PRICE",
        unitId: UNIT_L,
        costCenterId: CC_TRANSPORT,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-1234",
      }),
      draft({ expenseTypeId: OTHER_ID, amount: "50" }),
      draft({
        expenseTypeId: REPAIR_ID,
        costCenterId: CC_TRANSPORT,
        costObjectType: "VEHICLE",
        costObjectLabel: "ซ่อมหน้างาน",
      }),
    ]
    expect(anyLineRequiresVendor(lines, types)).toBe(true)
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: "", lines, types })).toBe("ต้องระบุผู้ขาย")
    expect(() =>
      assertHeaderVendor([{ requiresVendor: true }, { requiresVendor: false }, { requiresVendor: true }], null)
    ).toThrow("ต้องระบุผู้ขาย")
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: VENDOR, lines, types })).toBeNull()
  })

  it("8. edit payload keeps type / CC / unit / cost object and drops a legacy processId", () => {
    const parsed = expenseLineInputSchema.safeParse({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      quantity: 5,
      unitId: UNIT_L,
      unitCode: "L",
      unitPrice: 35,
      processId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      costCenterId: CC_TRANSPORT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-5678",
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty("processId")
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "QTY_PRICE",
        costCenterId: parsed.data.costCenterId ?? null,
        unitId: parsed.data.unitId ?? null,
        costObjectType: parsed.data.costObjectType ?? null,
        costObjectLabel: parsed.data.costObjectLabel ?? null,
      },
      fuelMeta(),
      lookup
    )
    expect(out.costCenterId).toBe(CC_TRANSPORT)
    expect(out.unitId).toBe(UNIT_L)
    expect(out.unitCode).toBe("L")
    expect(out.costObjectType).toBe("VEHICLE")
    expect(out.costObjectLabel).toBe("70-5678")
  })
})

describe("transport-sourced lines start in the ขนส่ง cost center", () => {
  const transportLine = (over: Partial<LineDraft> = {}) =>
    draft({
      expenseTypeId: "",
      sourceKind: "MODULE",
      sourceModule: "TRANSPORT",
      sourceType: "TRANSPORT_JOB",
      costObjectType: "JOB",
      costObjectLabel: "TJ-2026-00009",
      ...over,
    })

  it("matches the active cost center named ขนส่ง only", () => {
    expect(transportCostCenterId(costCenters)).toBe(CC_TRANSPORT)
    expect(transportCostCenterId(costCenters.filter((c) => c.id !== CC_TRANSPORT))).toBe("")
    expect(
      transportCostCenterId(costCenters.map((c) => (c.id === CC_TRANSPORT ? { ...c, isActive: false } : c)))
    ).toBe("")
  })

  it("fills empty transport lines and leaves other lines alone", () => {
    expect(prefillSourceCostCenter(transportLine(), CC_TRANSPORT).costCenterId).toBe(CC_TRANSPORT)
    expect(prefillSourceCostCenter(transportLine({ costCenterId: CC_MAINT }), CC_TRANSPORT).costCenterId).toBe(CC_MAINT)
    expect(prefillSourceCostCenter(draft({ expenseTypeId: "" }), CC_TRANSPORT).costCenterId).toBe("")
    expect(prefillSourceCostCenter(transportLine(), "").costCenterId).toBe("")
  })

  it("keeps the transport cost center over a type default when the type allows it", () => {
    const tollDefaultMaint = { ...toll, defaultCostCenterId: CC_MAINT }
    const line = transportLine({ costCenterId: CC_TRANSPORT })
    expect(applyTypeChange(line, tollDefaultMaint).costCenterId).toBe(CC_TRANSPORT)
    expect(applyTypeChange(line, fuel).costCenterId).toBe(CC_TRANSPORT)
  })

  it("drops the transport cost center when the type allowlist excludes it", () => {
    const maintOnly = { ...water, allowedCostCenterIds: [CC_MAINT], defaultCostCenterId: CC_MAINT }
    const maintOnlyNoDefault = { ...water, allowedCostCenterIds: [CC_MAINT] }
    const line = transportLine({ costCenterId: CC_TRANSPORT })
    expect(applyTypeChange(line, maintOnly).costCenterId).toBe(CC_MAINT)
    expect(applyTypeChange(line, maintOnlyNoDefault).costCenterId).toBe("")
  })

  it("a line without a process takes the type default cost center", () => {
    const next = applyTypeChange(draft({ expenseTypeId: "" }), fuel)
    expect(next.costCenterId).toBe(CC_TRANSPORT)
    expect(next).not.toHaveProperty("processId")
    expect(validateLineDraft({ ...next, costObjectType: "VEHICLE", unitId: UNIT_L, pricingMode: "QTY_PRICE" }, fuel)).toBeNull()
  })

  it("manual lines still take the type default", () => {
    const tollDefaultMaint = { ...toll, defaultCostCenterId: CC_MAINT }
    expect(applyTypeChange(draft({ expenseTypeId: "", costCenterId: CC_TRANSPORT }), tollDefaultMaint).costCenterId).toBe(
      CC_MAINT
    )
  })
})

describe("asset on expense lines", () => {
  const ASSET_ID = "31111111-1111-1111-1111-111111111111"
  const withAsset = (over: Partial<LineDraft> = {}) =>
    draft({
      expenseTypeId: "",
      costObjectType: "VEHICLE",
      costObjectId: ASSET_ID,
      costObjectLabel: "AST-001 — รถบรรทุก",
      ...over,
    })

  it("keeps the asset when the type does not require a machine or location", () => {
    for (const type of [other, fuel, toll]) {
      const next = applyTypeChange(withAsset(), type)
      expect(next.costObjectType).toBe("VEHICLE")
      expect(next.costObjectId).toBe(ASSET_ID)
      expect(next.costObjectLabel).toBe("AST-001 — รถบรรทุก")
    }
  })

  it("clears the asset when the new type requires a location", () => {
    const next = applyTypeChange(withAsset(), water)
    expect(next.costObjectType).toBe("LOCATION")
    expect(next.costObjectId).toBe("")
    expect(next.costObjectLabel).toBe("")
  })

  it("clears a location when moving to a type without one", () => {
    const next = applyTypeChange(draft({ expenseTypeId: WATER_ID, costObjectType: "LOCATION", costObjectLabel: "สาขา 1" }), other)
    expect(next.costObjectType).toBe("")
    expect(next.costObjectLabel).toBe("")
  })

  it("accepts a line with no asset on a type that does not need one", () => {
    const next = applyTypeChange(draft({ expenseTypeId: "", amount: "100", description: "ค่าจอด" }), other)
    expect(next.costObjectType).toBe("")
    expect(validateLineDraft(next, other)).toBeNull()
  })

  it("server accepts an asset on a type without vehicle rules and an empty asset on a vehicle type", () => {
    const meta = (requiresVehicle: boolean): TypeDimensionMeta => ({
      id: requiresVehicle ? TOLL_ID : OTHER_ID,
      requiresVendor: false,
      requiresVehicle,
      requiresMachine: false,
      requiresLocation: false,
      requiresCostCenter: false,
      allowedCostCenterIds: [],
      defaultCostCenterId: null,
    })
    const line = (costObjectLabel: string) => ({
      lineNo: 1,
      pricingMode: "AMOUNT" as const,
      costCenterId: null,
      unitId: null,
      costObjectType: "VEHICLE" as const,
      costObjectLabel,
    })
    expect(() => assertLineDimensions(line("AST-001 — รถบรรทุก"), meta(false), lookup)).not.toThrow()
    expect(() => assertLineDimensions(line(""), meta(true), lookup)).not.toThrow()
  })
})
