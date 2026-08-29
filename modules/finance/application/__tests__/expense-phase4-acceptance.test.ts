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
  costCenterOptions,
  processOptions,
  validateExpenseForm,
  validateLineDraft,
} from "@/components/finance/expense-form-validation"
import type { CostCenterRow, ExpenseTypeOption, LineDraft, ProcessRow } from "@/components/finance/expense-types"

const CC_TRANSPORT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CC_MAINT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const PROC_COLLECT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const PROC_ADMIN = "dddddddd-dddd-dddd-dddd-dddddddddddd"
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
    requiresProcess: false,
    isActive: true,
    costCenterCount: 0,
    processCount: 0,
    allowedCostCenterIds: [],
    defaultCostCenterId: null,
    allowedProcessIds: [],
    defaultProcessId: null,
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
  requiresProcess: true,
  allowedCostCenterIds: [CC_TRANSPORT],
  defaultCostCenterId: CC_TRANSPORT,
  allowedProcessIds: [PROC_COLLECT],
  defaultProcessId: PROC_COLLECT,
})
const repair = typeOpt({
  id: REPAIR_ID,
  code: "EXP-0602",
  name: "ค่าซ่อมรถ",
  requiresVendor: true,
  requiresVehicle: true,
  requiresCostCenter: true,
  requiresProcess: true,
  allowedCostCenterIds: [CC_TRANSPORT],
  defaultCostCenterId: CC_TRANSPORT,
  allowedProcessIds: [PROC_COLLECT],
  defaultProcessId: PROC_COLLECT,
})
const toll = typeOpt({
  id: TOLL_ID,
  code: "EXP-0202",
  name: "ค่าทางด่วน",
  requiresVehicle: true,
  requiresCostCenter: true,
  requiresProcess: true,
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
const processes: ProcessRow[] = [
  { id: PROC_COLLECT, code: "PROC-COLLECTION", name: "จัดเก็บ", parentId: null, parentName: null, isActive: true },
  { id: PROC_ADMIN, code: "PROC-ADMIN", name: "บริหารงานทั่วไป", parentId: null, parentName: null, isActive: true },
]

function draft(over: Partial<LineDraft> & { expenseTypeId: string }): LineDraft {
  return {
    key: "k1",
    expenseTypeId: over.expenseTypeId,
    description: "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: "",
    amount: "100",
    taxAmount: "",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    processId: "",
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
    requiresProcess: true,
    allowedCostCenterIds: [CC_TRANSPORT],
    defaultCostCenterId: CC_TRANSPORT,
    allowedProcessIds: [PROC_COLLECT],
    defaultProcessId: PROC_COLLECT,
  }
}

const lookup: DimensionLookup = {
  activeCostCenterIds: new Set([CC_TRANSPORT, CC_MAINT]),
  activeProcessIds: new Set([PROC_COLLECT, PROC_ADMIN]),
  unitsById: new Map([[UNIT_L, { code: "L" }]]),
}

describe("Expense Phase 4 acceptance (8/8)", () => {
  it("1. unrestricted type saves without vendor / CC / process", () => {
    const line = draft({ expenseTypeId: OTHER_ID, amount: "250" })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: "", lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      { lineNo: 1, pricingMode: "AMOUNT", costCenterId: null, processId: null, unitId: null, costObjectType: null, costObjectLabel: null },
      {
        id: OTHER_ID,
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
      },
      lookup
    )
    expect(out.costCenterId).toBeNull()
    expect(out.processId).toBeNull()
    expect(() => assertHeaderVendor([{ requiresVendor: false }], null)).not.toThrow()
  })

  it("2. fuel requires vendor + default CC/process + vehicle + unit L", () => {
    const line = draft({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      quantity: "10",
      unitId: UNIT_L,
      unitCode: "L",
      unitPrice: "35",
      amount: "350",
      costCenterId: CC_TRANSPORT,
      processId: PROC_COLLECT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-1234",
    })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: VENDOR, lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "QTY_PRICE",
        costCenterId: null,
        processId: null,
        unitId: UNIT_L,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-1234",
      },
      fuelMeta(),
      lookup
    )
    expect(out.costCenterId).toBe(CC_TRANSPORT)
    expect(out.processId).toBe(PROC_COLLECT)
    expect(out.unitId).toBe(UNIT_L)
    expect(out.unitCode).toBe("L")
    expect(out.costObjectType).toBe("VEHICLE")
    expect(() => assertHeaderVendor([{ requiresVendor: true }], VENDOR)).not.toThrow()
  })

  it("3. fuel without vehicle — UI warn and server reject", () => {
    const line = draft({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      unitId: UNIT_L,
      costCenterId: CC_TRANSPORT,
      processId: PROC_COLLECT,
      costObjectType: "VEHICLE",
      costObjectLabel: "",
    })
    expect(validateLineDraft(line, fuel)).toBe("ต้องระบุรถ")
    expect(() =>
      assertLineDimensions(
        {
          lineNo: 1,
          pricingMode: "QTY_PRICE",
          costCenterId: CC_TRANSPORT,
          processId: PROC_COLLECT,
          unitId: UNIT_L,
          costObjectType: "VEHICLE",
          costObjectLabel: "  ",
        },
        fuelMeta(),
        lookup
      )
    ).toThrow("ต้องระบุรถ")
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
      processId: PROC_COLLECT,
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
          processId: PROC_COLLECT,
          unitId: UNIT_L,
          costObjectType: "VEHICLE",
          costObjectLabel: "70-1234",
        },
        fuelMeta(),
        lookup
      )
    ).toThrow("หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต")
  })

  it("5. no maps — every active company CC and process is selectable", () => {
    expect(costCenterOptions(toll, costCenters, "").map((c) => c.id)).toEqual([CC_TRANSPORT, CC_MAINT])
    expect(processOptions(toll, processes, "").map((p) => p.id)).toEqual([PROC_COLLECT, PROC_ADMIN])
    const line = draft({
      expenseTypeId: TOLL_ID,
      costCenterId: CC_MAINT,
      processId: PROC_ADMIN,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-9999",
    })
    expect(validateExpenseForm({ branchId: BRANCH, vendorId: "", lines: [line], types })).toBeNull()
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "AMOUNT",
        costCenterId: CC_MAINT,
        processId: PROC_ADMIN,
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
        requiresProcess: true,
        allowedCostCenterIds: [],
        defaultCostCenterId: null,
        allowedProcessIds: [],
        defaultProcessId: null,
      },
      lookup
    )
    expect(out.costCenterId).toBe(CC_MAINT)
    expect(out.processId).toBe(PROC_ADMIN)
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
          processId: null,
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
          requiresProcess: false,
          allowedCostCenterIds: [],
          defaultCostCenterId: null,
          allowedProcessIds: [],
          defaultProcessId: null,
        },
        lookup
      )
    ).toThrow("ประเภทวัตถุต้นทุนต้องเป็นสถานที่")
    const ok = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "AMOUNT",
        costCenterId: CC_TRANSPORT,
        processId: null,
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
        requiresProcess: false,
        allowedCostCenterIds: [],
        defaultCostCenterId: null,
        allowedProcessIds: [],
        defaultProcessId: null,
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
        processId: PROC_COLLECT,
        costObjectType: "VEHICLE",
        costObjectLabel: "70-1234",
      }),
      draft({ expenseTypeId: OTHER_ID, amount: "50" }),
      draft({
        expenseTypeId: REPAIR_ID,
        costCenterId: CC_TRANSPORT,
        processId: PROC_COLLECT,
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

  it("8. edit payload keeps type / CC / process / unit / cost object", () => {
    const parsed = expenseLineInputSchema.safeParse({
      expenseTypeId: FUEL_ID,
      pricingMode: "QTY_PRICE",
      quantity: 5,
      unitId: UNIT_L,
      unitCode: "L",
      unitPrice: 35,
      processId: PROC_COLLECT,
      costCenterId: CC_TRANSPORT,
      costObjectType: "VEHICLE",
      costObjectLabel: "70-5678",
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    const out = assertLineDimensions(
      {
        lineNo: 1,
        pricingMode: "QTY_PRICE",
        costCenterId: parsed.data.costCenterId ?? null,
        processId: parsed.data.processId ?? null,
        unitId: parsed.data.unitId ?? null,
        costObjectType: parsed.data.costObjectType ?? null,
        costObjectLabel: parsed.data.costObjectLabel ?? null,
      },
      fuelMeta(),
      lookup
    )
    expect(out.costCenterId).toBe(CC_TRANSPORT)
    expect(out.processId).toBe(PROC_COLLECT)
    expect(out.unitId).toBe(UNIT_L)
    expect(out.unitCode).toBe("L")
    expect(out.costObjectType).toBe("VEHICLE")
    expect(out.costObjectLabel).toBe("70-5678")
  })
})
