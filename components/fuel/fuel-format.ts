const qtyFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 })
const moneyFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const costFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export function fmtQty(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : qtyFormat.format(n)
}

export function fmtMoney(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : moneyFormat.format(n)
}

export function fmtCost(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : costFormat.format(n)
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Current Bangkok wall time in `datetime-local` format (YYYY-MM-DDTHH:mm). */
export function nowLocalInput(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

/** `datetime-local` value (Bangkok wall time) to ISO, or null when empty. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  return new Date(`${value}:00+07:00`).toISOString()
}

export function txnTypeVariant(type: string): "success" | "info" | "warning" | "danger" | "default" {
  if (type === "RECEIVE" || type === "TRANSFER_IN") return "success"
  if (type === "DISPENSE" || type === "TRANSFER_OUT") return "info"
  if (type === "ADJUST") return "warning"
  if (type === "REVERSAL") return "danger"
  return "default"
}
