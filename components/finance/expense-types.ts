import type { ExpenseStatus } from "./finance-theme"

export type ExpenseAttachmentDto = {
  id: string
  fileUrl: string
  fileName: string | null
  fileSize: number | null
}

export type PricingMode = "QTY_PRICE" | "AMOUNT"
export type SourceKind = "MANUAL" | "MODULE" | "IMPORT"
export type DiscountKind = "BAHT" | "PERCENT"

export type UnitOption = {
  id: string
  code: string
  name: string
  isActive: boolean
}

/** Client-side editable representation of a single expense line. */
export type LineDraft = {
  key: string
  expenseTypeId: string
  description: string
  pricingMode: PricingMode
  quantity: string
  unitId: string
  unitCode: string
  unitPrice: string
  amount: string
  taxAmount: string
  discountAmount: string
  discountKind: DiscountKind
  costCenterId: string
  processId: string
  costObjectType: string
  costObjectId: string
  costObjectLabel: string
  sourceKind: SourceKind
  sourceModule: string | null
  sourceType: string | null
  sourceDocumentId: string | null
  sourceLineId: string | null
  /** True only when the operational reference amount is > 0. Optional so locked Phase 4 drafts stay valid. */
  sourceAmountLocked?: boolean
}

export type ExpenseLineDto = {
  id: string
  lineNo: number
  expenseTypeId: string
  expenseTypeName: string
  transactionType: string
  description: string | null
  pricingMode: PricingMode
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitPrice: number
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  costCenterId: string | null
  costCenterName: string | null
  processId: string | null
  processName: string | null
  costObjectType: string | null
  costObjectId: string | null
  costObjectLabel: string | null
  sourceKind: SourceKind
  sourceModule: string | null
  sourceType: string | null
  sourceDocumentId: string | null
  sourceLineId: string | null
  sourceLinkActive: boolean
}

export type ExpenseDto = {
  id: string
  companyId: string
  branchId: string
  branchName: string
  expenseNo: string
  expenseDate: string
  postingDate: string
  expenseTypeId: string
  expenseTypeName: string
  transactionType: string
  sourceModule: string | null
  sourceType: string | null
  sourceId: string | null
  costCenterId: string | null
  costCenterName: string | null
  costObjectType: string | null
  costObjectId: string | null
  costObjectLabel: string | null
  vendorId: string | null
  vendorName: string | null
  employeeId: string | null
  employeeName: string | null
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  currency: string
  description: string | null
  notes: string | null
  status: ExpenseStatus
  paymentMethod: "cash" | "credit" | null
  paidAt: string | null
  paidById: string | null
  paidByName: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
  createdById: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
  attachments: ExpenseAttachmentDto[]
  lines: ExpenseLineDto[]
  lineCount: number
}

export type ExpenseSummary = {
  counts: Record<ExpenseStatus, number>
  totals: Record<ExpenseStatus, number>
}

export type Option = { id: string; name: string }
export type ExpenseCostType = "FIXED" | "VARIABLE" | "MIXED"
export type ExpenseDirectness = "DIRECT" | "INDIRECT"

export type ExpenseTypeOption = {
  id: string
  code: string | null
  name: string
  subcategory: string | null
  description: string | null
  categoryId: string | null
  categoryName: string | null
  transactionType: string
  defaultCostType: ExpenseCostType | null
  defaultDirectness: ExpenseDirectness | null
  defaultGlLabel: string | null
  requiresVendor: boolean
  requiresVehicle: boolean
  requiresMachine: boolean
  requiresLocation: boolean
  requiresCostCenter: boolean
  requiresProcess: boolean
  isActive: boolean
  costCenterCount: number
  processCount: number
  allowedCostCenterIds?: string[]
  defaultCostCenterId?: string | null
  allowedProcessIds?: string[]
  defaultProcessId?: string | null
}

export type ExpenseCategoryRow = {
  id: string
  code: string | null
  name: string
  description: string | null
  parentId: string | null
  parentName: string | null
  sequence: number
  isActive: boolean
}

export type ProcessRow = {
  id: string
  code: string | null
  name: string
  parentId: string | null
  parentName: string | null
  isActive: boolean
}

/** A single allowed/default mapping row (cost center or process) for an expense item. */
export type ExpenseTypeMapRow = {
  targetId: string
  code: string | null
  name: string
  isActive: boolean
  isDefault: boolean
  isAllowed: boolean
}
export type CostCenterRow = {
  id: string
  code: string | null
  name: string
  branchId: string | null
  branchName: string | null
  parentId: string | null
  parentName: string | null
  isActive: boolean
}

export type ExpenseSourceRow = {
  sourceType: "TRANSPORT_REPAIR" | "TRANSPORT_TIRE" | "TRANSPORT_JOB"
  sourceId: string
  sourceKind: "IMPORT"
  sourceModule: "TRANSPORT"
  sourceDocumentId: string
  sourceLineId: string | null
  branchId: string
  date: string
  vehicleId: string
  vehicleLabel: string
  amount: number | null
  paymentMethod: "cash" | "credit" | null
  description: string
  suggestedCostObjectType: "VEHICLE" | "JOB"
  groupKey: string
  groupLabel: string
  reviewStatus?: "PENDING"
}

export type FinancePerms = {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canApprove: boolean
  canManageMasters: boolean
}
