import type { PricingMode } from "./expense-types"

export type IncomeStatus = "DRAFT" | "PENDING" | "APPROVED" | "RECEIVED" | "REJECTED" | "CANCELLED"

export const INCOME_STATUS_LIST: IncomeStatus[] = ["DRAFT", "PENDING", "APPROVED", "RECEIVED", "REJECTED", "CANCELLED"]

export const INCOME_STATUS_BADGE: Record<IncomeStatus, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
  DRAFT: "default",
  PENDING: "warning",
  APPROVED: "info",
  RECEIVED: "success",
  REJECTED: "danger",
  CANCELLED: "outline",
}

export type IncomeTaxMode = "NONE" | "VAT_EXCLUSIVE" | "VAT_INCLUSIVE"

export const INCOME_TAX_MODES: IncomeTaxMode[] = ["NONE", "VAT_EXCLUSIVE", "VAT_INCLUSIVE"]

export const INCOME_VAT_RATE = 0.07

export type IncomeAttachmentDto = {
  id: string
  fileUrl: string
  fileName: string | null
  fileSize: number | null
  storedFileId?: string | null
}

export type IncomeLineDto = {
  id: string
  lineNo: number
  incomeTypeId: string
  incomeTypeCode: string | null
  incomeTypeName: string
  description: string | null
  pricingMode: PricingMode
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitName: string | null
  unitPrice: number
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  costCenterId: string | null
  costCenterName: string | null
  processId: string | null
  processName: string | null
}

export type IncomeDto = {
  id: string
  branchId: string
  branchName: string
  incomeNo: string
  incomeDate: string
  postingDate: string
  payerName: string
  employeeId: string | null
  employeeName: string | null
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  notes: string | null
  status: IncomeStatus
  paymentMethod: "cash" | "credit" | null
  taxMode: IncomeTaxMode
  receivedAt: string | null
  receivedByName: string | null
  approvedAt: string | null
  approvedByName: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string
  attachments: IncomeAttachmentDto[]
  lines: IncomeLineDto[]
  lineCount: number
}

export type IncomeSummary = {
  counts: Record<IncomeStatus, number>
  totals: Record<IncomeStatus, number>
}

export const EMPTY_INCOME_SUMMARY: IncomeSummary = {
  counts: { DRAFT: 0, PENDING: 0, APPROVED: 0, RECEIVED: 0, REJECTED: 0, CANCELLED: 0 },
  totals: { DRAFT: 0, PENDING: 0, APPROVED: 0, RECEIVED: 0, REJECTED: 0, CANCELLED: 0 },
}

export type IncomeTypeOption = {
  id: string
  code: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  isActive: boolean
}

export type IncomeCategoryRow = {
  id: string
  code: string
  name: string
  description: string | null
  parentId: string | null
  parentName: string | null
  sequence: number
  isActive: boolean
}

export type IncomeLineDraft = {
  key: string
  id?: string
  incomeTypeId: string
  description: string
  pricingMode: PricingMode
  quantity: string
  unitId: string
  unitPrice: string
  amount: string
  taxAmount: string
  discountAmount: string
  costCenterId: string
  processId: string
}
