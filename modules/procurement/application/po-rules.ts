import { ValidationError } from "@/lib/errors"

export const PURCHASE_ORDER_STATUSES = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const
export type PurchaseOrderStatusValue = (typeof PURCHASE_ORDER_STATUSES)[number]

export const PURCHASE_ATTACHMENT_KINDS = [
  "QUOTATION",
  "PRODUCT_PHOTO",
  "ORDER_PROOF",
  "DELIVERY_NOTE",
  "OTHER",
] as const
export type PurchaseAttachmentKindValue = (typeof PURCHASE_ATTACHMENT_KINDS)[number]

export const PURCHASE_COST_OBJECT_TYPES = ["GENERAL", "VEHICLE", "MACHINE", "ASSET"] as const
export type PurchaseCostObjectType = (typeof PURCHASE_COST_OBJECT_TYPES)[number]

const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatusValue, PurchaseOrderStatusValue[]> = {
  DRAFT: ["ORDERED", "CANCELLED"],
  ORDERED: ["DRAFT", "RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
}

export function canTransition(from: PurchaseOrderStatusValue, to: PurchaseOrderStatusValue): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/** Header and lines change only while the order is a draft. */
export function isEditableStatus(status: PurchaseOrderStatusValue): boolean {
  return status === "DRAFT"
}

/** Photos may be added or removed until the goods are received. */
export function canChangeAttachments(status: PurchaseOrderStatusValue): boolean {
  return status === "DRAFT" || status === "ORDERED"
}

/** One order holds this many photos and documents. */
export const MAX_PURCHASE_ATTACHMENTS = 10

/** How many more files fit on the order. Never negative. */
export function attachmentSlotsLeft(current: number): number {
  return Math.max(0, MAX_PURCHASE_ATTACHMENTS - current)
}

export type TransitionCheck = {
  from: PurchaseOrderStatusValue
  to: PurchaseOrderStatusValue
  lineCount: number
  reason?: string | null
}

export function assertTransition(check: TransitionCheck) {
  if (!canTransition(check.from, check.to)) {
    throw new ValidationError("เปลี่ยนสถานะนี้ไม่ได้")
  }
  if ((check.to === "ORDERED" || check.to === "RECEIVED") && check.lineCount < 1) {
    throw new ValidationError("ต้องมีรายการสินค้าอย่างน้อย 1 รายการ")
  }
  if (check.to === "CANCELLED" && !check.reason?.trim()) {
    throw new ValidationError("กรุณาระบุเหตุผลที่ยกเลิก")
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice)
}

export function sumLines(lines: Array<{ amount: number }>): number {
  return round2(lines.reduce((s, l) => s + l.amount, 0))
}

/** PO-YYYYMM-0001. `count` is how many numbers already use this month's prefix. */
export function formatPoNo(now: Date, count: number): string {
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
  return `PO-${ym}-${String(count + 1).padStart(4, "0")}`
}

export function poNoPrefix(now: Date): string {
  return formatPoNo(now, 0).slice(0, -4)
}
