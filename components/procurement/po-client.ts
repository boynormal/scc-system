import type {
  PurchaseAttachmentKindValue,
  PurchaseCostObjectType,
  PurchaseOrderStatusValue,
} from "@/modules/procurement/application/po-rules"

export type PoFinanceState =
  | { state: "PENDING" }
  | { state: "EXPENSE_CREATED" | "NO_EXPENSE"; expenseId?: string | null; expenseNo?: string | null; reason?: string | null }

export type PoLine = {
  id?: string
  description: string
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitPrice: number
  amount: number
  costObjectType: PurchaseCostObjectType | null
  costObjectLabel: string | null
}

export type PoAttachment = {
  id: string
  kind: PurchaseAttachmentKindValue
  fileName: string
  contentType: string
  sizeBytes: number
  url: string
  createdAt: string
}

export type PurchaseOrder = {
  id: string
  poNo: string
  status: PurchaseOrderStatusValue
  branchId: string
  branchName: string
  supplierId: string | null
  supplierName: string | null
  supplierCode: string | null
  supplierPhone: string | null
  orderDate: string
  neededDate: string | null
  orderedAt: string | null
  receivedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  requesterId: string
  requesterName: string | null
  createdByName: string | null
  notes: string | null
  estimatedTotal: number
  lines: PoLine[]
  attachments: PoAttachment[]
  finance: PoFinanceState | null
}

export type PoOptions = {
  branches: Array<{ id: string; name: string }>
  createBranchIds: string[]
  suppliers: Array<{ id: string; code: string | null; name: string }>
  units: Array<{ id: string; code: string; name: string }>
  users: Array<{ id: string; name: string }>
  currentUserId: string
}

export const PO_STATUS_BADGE: Record<PurchaseOrderStatusValue, "default" | "info" | "success" | "danger"> = {
  DRAFT: "default",
  ORDERED: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
}

export const PO_FINANCE_BADGE = {
  PENDING: "warning",
  EXPENSE_CREATED: "success",
  NO_EXPENSE: "default",
} as const

export function fmtMoney(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 3 })
}

export function fmtDate(value: string | null): string {
  if (!value) return "-"
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  })
}

export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Past the needed date while the goods have not arrived. */
export function isOverdue(po: Pick<PurchaseOrder, "status" | "neededDate">): boolean {
  if (!po.neededDate) return false
  if (po.status !== "DRAFT" && po.status !== "ORDERED") return false
  return po.neededDate < todayIso()
}
