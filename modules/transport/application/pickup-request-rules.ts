import { z } from "zod"
import { isInactiveStop, orderedActiveStops, type PunchKind } from "./job-punch-rules"

export type PickupDisplayStatus =
  | "waiting"
  | "requeue"
  | "scheduled"
  | "in_progress"
  | "picked"
  | "cancelled"

export const PICKUP_STATUS_LABEL: Record<PickupDisplayStatus, string> = {
  waiting: "รอจัดคิว",
  requeue: "รอจัดคิวใหม่",
  scheduled: "จัดคิวแล้ว",
  in_progress: "กำลังเดินทาง",
  picked: "รับสินค้าแล้ว",
  cancelled: "ยกเลิก",
}

/** Statuses between the driver's start punch and the finish punch. */
export const RUNNING_JOB_STATUSES = [
  "en_route",
  "at_pickup",
  "loading",
  "departed",
  "at_destination",
  "unloading",
] as const

export const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/
export const PICKUP_MAX_LINES = 20
export const PICKUP_MAX_OPEN_PER_CUSTOMER = 10

/** Cargo the customer can request. Other transport cargo types stay in master data. */
export const PICKUP_CARGO_NAMES = ["แบตเตอรี่ใหญ่", "แบตเตอรี่เล็ก", "ตะกั่ว"] as const

/** Piece count first, so it is the default. Kilogram is the other choice. */
export const PICKUP_UNIT_CODES = ["LUK", "KG"] as const

function inListedOrder<T>(items: T[], key: (item: T) => string, order: readonly string[]): T[] {
  const rank = new Map<string, number>(order.map((value, index) => [value, index]))
  return items
    .filter((item) => rank.has(key(item)))
    .sort((left, right) => (rank.get(key(left)) ?? 0) - (rank.get(key(right)) ?? 0))
}

export function pickupCargoTypes<T extends { name: string }>(types: T[]): T[] {
  return inListedOrder(types, (type) => type.name, PICKUP_CARGO_NAMES)
}

export function pickupUnits<T extends { code: string }>(units: T[]): T[] {
  return inListedOrder(units, (unit) => unit.code, PICKUP_UNIT_CODES)
}

export function isPickupPublicToken(token: string): boolean {
  return PUBLIC_TOKEN_RE.test(token)
}

export function isRunningJobStatus(status: string): boolean {
  return (RUNNING_JOB_STATUSES as readonly string[]).includes(status)
}

export const pickupRequestLineSchema = z.object({
  cargoTypeId: z.string().uuid("เลือกประเภทสินค้า"),
  quantity: z.number().positive("จำนวนต้องมากกว่า 0").max(9_999_999_999),
  unitId: z.string().uuid("เลือกหน่วย"),
  note: z.string().trim().max(500).optional().nullable(),
})

export const submitPickupRequestSchema = z.object({
  contactName: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(pickupRequestLineSchema)
    .min(1, "เพิ่มรายการสินค้าอย่างน้อย 1 รายการ")
    .max(PICKUP_MAX_LINES, `เพิ่มได้ไม่เกิน ${PICKUP_MAX_LINES} รายการ`),
})

export type SubmitPickupRequestInput = z.infer<typeof submitPickupRequestSchema>

export type PickupStatusSource = {
  status: "SUBMITTED" | "CANCELLED"
  jobStop: null | {
    status: string
    estimatedArrival: Date | null
    punches: { recordedAt: Date }[]
    job: { status: string; scheduledDate: Date | null }
  }
}

export type PickupStatusView = {
  status: PickupDisplayStatus
  plannedAt: Date | null
  pickedAt: Date | null
}

function earliest(dates: Date[]): Date | null {
  if (dates.length === 0) return null
  return dates.reduce((min, date) => (date.getTime() < min.getTime() ? date : min))
}

/** Status shown to the customer and the staff queue; computed from the linked stop, never stored. */
export function pickupDisplayStatus(request: PickupStatusSource): PickupStatusView {
  if (request.status === "CANCELLED") return { status: "cancelled", plannedAt: null, pickedAt: null }
  const stop = request.jobStop
  if (!stop) return { status: "waiting", plannedAt: null, pickedAt: null }
  if (isInactiveStop(stop.status) || stop.job.status === "cancelled") {
    return { status: "requeue", plannedAt: null, pickedAt: null }
  }
  const plannedAt = stop.estimatedArrival ?? stop.job.scheduledDate
  const pickedAt = earliest(stop.punches.map((punch) => punch.recordedAt))
  if (pickedAt) return { status: "picked", plannedAt, pickedAt }
  if (isRunningJobStatus(stop.job.status)) return { status: "in_progress", plannedAt, pickedAt: null }
  return { status: "scheduled", plannedAt, pickedAt: null }
}

export function isQueuedPickupStatus(status: PickupDisplayStatus) {
  return status === "waiting" || status === "requeue"
}

export type AttachJobSource = {
  status: string
  stops: { id: string; sequence: number; status: string }[]
  punches: { stopId: string | null; kind: PunchKind }[]
}

/** Option C: open jobs only, and the driver has not reached the last active stop yet. */
export function canAttachToJob(job: AttachJobSource): { ok: boolean; running: boolean } {
  const running = isRunningJobStatus(job.status)
  if (job.status === "completed" || job.status === "cancelled" || job.status === "pending_review") {
    return { ok: false, running }
  }
  if (job.punches.some((punch) => punch.kind === "finish")) return { ok: false, running }
  const active = orderedActiveStops(job.stops)
  const last = active[active.length - 1]
  if (last && job.punches.some((punch) => punch.stopId === last.id)) return { ok: false, running }
  return { ok: true, running }
}

export type PickupLineLabelSource = {
  quantity: unknown
  note: string | null
  cargoType: { name: string }
  unit: { name: string }
}

function formatQuantity(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return num.toLocaleString("th-TH", { maximumFractionDigits: 2 })
}

export function pickupLineLabel(line: PickupLineLabelSource): string {
  const base = `${line.cargoType.name} ${formatQuantity(line.quantity)} ${line.unit.name}`
  return line.note?.trim() ? `${base} (${line.note.trim()})` : base
}

export type PickupDraftSource = {
  requestNo: number
  contactName: string | null
  phone: string | null
  note: string | null
  customer: {
    name: string
    address: string | null
    contactName: string | null
    phone: string | null
  }
  lines: PickupLineLabelSource[]
}

export type PickupStopDraft = {
  customerName: string
  address: string
  contactName: string
  contactPhone: string
  notes: string
}

export function pickupRequestToStopDraft(request: PickupDraftSource): PickupStopDraft {
  const items = request.lines.map(pickupLineLabel).join(", ")
  const note = request.note?.trim()
  return {
    customerName: request.customer.name,
    address: request.customer.address?.trim() || "-",
    contactName: request.contactName?.trim() || request.customer.contactName?.trim() || "",
    contactPhone: request.phone?.trim() || request.customer.phone?.trim() || "",
    notes: `คำขอ #${request.requestNo}: ${items}${note ? ` (${note})` : ""}`,
  }
}

/** Header customer plus how many other customers appear on the stops. */
export function otherStopCustomerCount(
  headerName: string | null | undefined,
  stops: { customerName: string }[]
): number {
  const header = headerName?.trim().toLowerCase() ?? ""
  const others = new Set(
    stops
      .map((stop) => stop.customerName.trim().toLowerCase())
      .filter((name) => name && name !== header)
  )
  return others.size
}
