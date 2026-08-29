export const FIN_GLASS_PANEL =
  "border-slate-300/70 bg-white/80 shadow-[0_10px_32px_rgb(15_23_42/0.12)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/40 dark:shadow-[0_16px_48px_rgb(0_0_0/0.35)]"

export const FIN_GLASS_FIELD =
  "border-slate-300 bg-white/90 backdrop-blur-sm dark:border-white/15 dark:bg-slate-950/35"

export type ExpenseStatus = "DRAFT" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED"

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "ร่าง",
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  PAID: "จ่ายแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
}

export const EXPENSE_STATUS_BADGE: Record<ExpenseStatus, string> = {
  DRAFT:
    "border-slate-300 bg-slate-200/70 text-slate-700 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300",
  PENDING:
    "border-amber-300 bg-amber-400/30 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200",
  APPROVED:
    "border-sky-300 bg-sky-400/30 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200",
  PAID:
    "border-emerald-300 bg-emerald-400/30 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200",
  REJECTED:
    "border-red-300 bg-red-400/30 text-red-800 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-200",
  CANCELLED:
    "border-slate-300 bg-slate-200/60 text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400",
}

export const SOURCE_MODULE_LABELS: Record<string, string> = {
  MANUAL: "บันทึกเอง",
  TRANSPORT: "ขนส่ง",
  MAINTENANCE: "ซ่อมบำรุง",
  INVENTORY: "คลังสินค้า",
  HR: "บุคคล",
  OTHER: "อื่นๆ",
}

/** Header/line source module can be null (manual bill or mixed modules). */
export function sourceModuleLabel(module: string | null | undefined): string {
  if (!module) return "บันทึกเอง"
  return SOURCE_MODULE_LABELS[module] ?? module
}

export const SOURCE_KIND_LABELS: Record<string, string> = {
  MANUAL: "บันทึกเอง",
  MODULE: "เชื่อมโมดูล",
  IMPORT: "นำเข้าจากต้นทาง",
}

export const PRICING_MODE_LABELS: Record<string, string> = {
  QTY_PRICE: "จำนวน × ราคา",
  AMOUNT: "ระบุยอดรวม",
}

export const COST_OBJECT_TYPE_LABELS: Record<string, string> = {
  VEHICLE: "รถ",
  MACHINE: "เครื่องจักร",
  TIRE: "ยาง",
  JOB: "งาน",
  CUSTOMER: "ลูกค้า",
  PRODUCT: "สินค้า",
  PROJECT: "โปรเจกต์",
  LOCATION: "สถานที่",
  OTHER: "อื่นๆ",
}

const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatBaht(value: number): string {
  return baht.format(value)
}
