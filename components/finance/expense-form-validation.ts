import type { CostCenterRow, ExpenseTypeOption, LineDraft } from "./expense-types"

export function isLegacyUnrestricted(type?: ExpenseTypeOption | null): boolean {
  if (!type) return true
  const noRequires =
    !type.requiresCostCenter &&
    !type.requiresVehicle &&
    !type.requiresMachine &&
    !type.requiresLocation
  const noMaps = (type.allowedCostCenterIds?.length ?? 0) === 0
  return noRequires && noMaps
}

export const TRANSPORT_COST_CENTER_NAME = "ขนส่ง"

/** Active cost center that transport-sourced lines start with, if the company has one. */
export function transportCostCenterId(costCenters: CostCenterRow[]): string {
  return costCenters.find((c) => c.isActive && c.name.trim() === TRANSPORT_COST_CENTER_NAME)?.id ?? ""
}

export function prefillSourceCostCenter(line: LineDraft, transportCcId: string): LineDraft {
  if (line.sourceModule !== "TRANSPORT" || line.costCenterId || !transportCcId) return line
  return { ...line, costCenterId: transportCcId }
}

export function applyTypeChange(draft: LineDraft, type: ExpenseTypeOption | undefined): LineDraft {
  if (!type) return { ...draft, expenseTypeId: "" }
  const allowedCc = type.allowedCostCenterIds ?? []
  const next: LineDraft = { ...draft, expenseTypeId: type.id }
  const keepSourceCc =
    draft.sourceModule === "TRANSPORT" &&
    Boolean(draft.costCenterId) &&
    (allowedCc.length === 0 || allowedCc.includes(draft.costCenterId))

  if (!keepSourceCc) {
    if (type.defaultCostCenterId) {
      next.costCenterId = type.defaultCostCenterId
    } else if (allowedCc.length && next.costCenterId && !allowedCc.includes(next.costCenterId)) {
      next.costCenterId = ""
    }
  }

  const expected = type.requiresVehicle
    ? "VEHICLE"
    : type.requiresMachine
      ? "MACHINE"
      : type.requiresLocation
        ? "LOCATION"
        : null
  if (expected) {
    if (next.costObjectType !== expected) {
      if (next.costObjectType) {
        next.costObjectId = ""
        next.costObjectLabel = ""
      }
      next.costObjectType = expected
    }
  } else if (next.costObjectType === "MACHINE" || next.costObjectType === "LOCATION") {
    next.costObjectType = ""
    next.costObjectId = ""
    next.costObjectLabel = ""
  }

  return next
}

function allowlistOrActive<T extends { id: string; isActive: boolean }>(
  all: T[],
  allowedIds: string[] | undefined,
  currentId: string
): T[] {
  if (allowedIds && allowedIds.length > 0) {
    return all.filter((row) => allowedIds.includes(row.id) || row.id === currentId)
  }
  return all.filter((row) => row.isActive || row.id === currentId)
}

export function costCenterOptions(type: ExpenseTypeOption | undefined, costCenters: CostCenterRow[], currentId: string) {
  return allowlistOrActive(costCenters, type?.allowedCostCenterIds, currentId)
}

export function anyLineRequiresVendor(lines: LineDraft[], types: ExpenseTypeOption[]): boolean {
  return lines.some((l) => types.find((t) => t.id === l.expenseTypeId)?.requiresVendor)
}

/** Same user-facing rules as the server. Server remains the source of truth. */
export function validateLineDraft(
  draft: LineDraft,
  type: ExpenseTypeOption | undefined,
  extras?: { locked?: boolean }
): string | null {
  if (!draft.expenseTypeId || !type) return "กรุณาเลือกประเภทค่าใช้จ่าย"
  const locked = extras?.locked ?? Boolean(draft.sourceAmountLocked)

  if (type.requiresCostCenter && !draft.costCenterId && !type.defaultCostCenterId) {
    return "ต้องระบุหน่วยงานต้นทุน"
  }
  const allowedCc = type.allowedCostCenterIds ?? []
  if (allowedCc.length && draft.costCenterId && !allowedCc.includes(draft.costCenterId)) {
    return "หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต"
  }

  if (type.requiresMachine) {
    if (draft.costObjectType !== "MACHINE") return "ประเภทวัตถุต้นทุนต้องเป็นเครื่องจักร"
    if (!draft.costObjectLabel.trim()) return "ต้องระบุเครื่องจักร"
  }
  if (type.requiresLocation) {
    if (draft.costObjectType !== "LOCATION") return "ประเภทวัตถุต้นทุนต้องเป็นสถานที่"
    if (!draft.costObjectLabel.trim()) return "ต้องระบุสถานที่"
  }

  if (!locked && draft.pricingMode === "QTY_PRICE" && !draft.unitId) {
    return "กรุณาเลือกหน่วย"
  }
  return null
}

export function validateExpenseForm(params: {
  branchId: string
  vendorId: string
  lines: LineDraft[]
  types: ExpenseTypeOption[]
}): string | null {
  if (!params.branchId) return "กรุณาเลือกสาขา"
  if (params.lines.length === 0) return "ต้องมีอย่างน้อย 1 บรรทัด"
  if (anyLineRequiresVendor(params.lines, params.types) && !params.vendorId) {
    return "ต้องระบุผู้ขาย"
  }
  for (let i = 0; i < params.lines.length; i++) {
    const line = params.lines[i]
    const type = params.types.find((t) => t.id === line.expenseTypeId)
    const err = validateLineDraft(line, type)
    if (err) return `บรรทัดที่ ${i + 1}: ${err}`
  }
  return null
}
