import type { PrismaClient } from "@prisma/client"

export type TransportCostSourceType = "TRANSPORT_REPAIR" | "TRANSPORT_TIRE" | "TRANSPORT_JOB"

export type TransportCostSource = {
  sourceType: TransportCostSourceType
  /** Upstream document id (repair / tire log / job id). */
  sourceId: string
  branchId: string
  date: string
  vehicleId: string
  vehicleLabel: string
  /** Reference amount only. `null` ≠ `0`. Not an Expense. */
  amount: number | null
  paymentMethod: "cash" | "credit" | null
  /** Human document code when the operational module has one (job / repair / tire number). */
  documentNo: string | null
  /** Readable note only — do not prefix with the document number. */
  description: string | null
}

export const TAKE_LIMIT = 300

/** Keep `null` and `0` distinct. Non-finite values become null. */
export function toReferenceAmount(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Lock IMPORT amount only when the operational reference is strictly > 0. */
export function isLockedReferenceAmount(amount: number | null): boolean {
  return amount != null && amount > 0
}

export function jobSourceIdentity(jobId: string): {
  sourceType: "TRANSPORT_JOB"
  sourceDocumentId: string
  sourceLineId: null
} {
  return { sourceType: "TRANSPORT_JOB", sourceDocumentId: jobId, sourceLineId: null }
}

type RepairRow = {
  id: string
  branchId: string
  reportedAt: Date
  vehicleId: string
  repairCost: unknown
  paymentMethod: "cash" | "credit" | null
  symptom: string
  repairNumber: string
  vehicle: { id: string; plateNumber: string } | null
}

type TireRow = {
  id: string
  branchId: string
  workDate: Date
  vehicleId: string
  cost: unknown
  paymentMethod: "cash" | "credit" | null
  tireNumber: string
  vehicle: { id: string; plateNumber: string } | null
}

type JobRow = {
  id: string
  branchId: string
  jobNumber: string
  customerName: string | null
  scheduledDate: Date | null
  createdAt: Date
  updatedAt: Date
  assignment: {
    vehicleId: string
    vehicle: { id: string; plateNumber: string } | null
  } | null
}

export function mapRepair(r: RepairRow): TransportCostSource {
  return {
    sourceType: "TRANSPORT_REPAIR",
    sourceId: r.id,
    branchId: r.branchId,
    date: r.reportedAt.toISOString(),
    vehicleId: r.vehicleId,
    vehicleLabel: r.vehicle?.plateNumber ?? "-",
    amount: toReferenceAmount(r.repairCost),
    paymentMethod: r.paymentMethod ?? null,
    documentNo: r.repairNumber,
    description: r.symptom.trim().slice(0, 255) || null,
  }
}

export function mapTire(t: TireRow): TransportCostSource {
  return {
    sourceType: "TRANSPORT_TIRE",
    sourceId: t.id,
    branchId: t.branchId,
    date: t.workDate.toISOString(),
    vehicleId: t.vehicleId,
    vehicleLabel: t.vehicle?.plateNumber ?? "-",
    amount: toReferenceAmount(t.cost),
    paymentMethod: t.paymentMethod ?? null,
    documentNo: t.tireNumber,
    description: "ค่ายาง",
  }
}

/** 1 completed job = 1 source. Stops are not source lines. */
export function mapJob(j: JobRow): TransportCostSource {
  const date = j.scheduledDate ?? j.updatedAt ?? j.createdAt
  const customer = j.customerName?.trim()
  return {
    sourceType: "TRANSPORT_JOB",
    sourceId: j.id,
    branchId: j.branchId,
    date: date.toISOString(),
    vehicleId: j.assignment?.vehicleId ?? "",
    vehicleLabel: j.assignment?.vehicle?.plateNumber ?? "-",
    amount: null,
    paymentMethod: null,
    documentNo: j.jobNumber,
    description: customer ? customer.slice(0, 255) : null,
  }
}

const vehicleSelect = { select: { id: true, plateNumber: true } } as const
const jobInclude = { assignment: { include: { vehicle: vehicleSelect } } } as const

function branchWhere(branchIds: string[] | null) {
  if (branchIds === null) return {}
  return {
    branchId: {
      in: branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"],
    },
  }
}

/**
 * Finance-ready operational events for the review queue:
 * closed repairs, every tire log, completed jobs.
 * Amount is not an eligibility filter. Callers apply RBAC + review exclusion.
 */
export async function listTransportCostSources(
  db: PrismaClient,
  params: { companyId: string; branchIds: string[] | null }
): Promise<TransportCostSource[]> {
  const scoped = branchWhere(params.branchIds)

  const [repairs, tires, jobs] = await Promise.all([
    db.transportRepairLog.findMany({
      where: { companyId: params.companyId, status: "closed", ...scoped },
      include: { vehicle: vehicleSelect },
      orderBy: { reportedAt: "desc" },
      take: TAKE_LIMIT,
    }),
    db.transportTireLog.findMany({
      where: { companyId: params.companyId, ...scoped },
      include: { vehicle: vehicleSelect },
      orderBy: { workDate: "desc" },
      take: TAKE_LIMIT,
    }),
    db.transportJob.findMany({
      where: { companyId: params.companyId, status: "completed", ...scoped },
      include: jobInclude,
      orderBy: { updatedAt: "desc" },
      take: TAKE_LIMIT,
    }),
  ])

  return [...repairs.map(mapRepair), ...tires.map(mapTire), ...jobs.map(mapJob)].sort((a, b) =>
    a.date < b.date ? 1 : -1
  )
}

/**
 * Re-fetch specific sources by id so Finance can attach a line when the
 * reference amount is null or 0. No amount filter. Jobs are 1:1 with job id.
 */
export async function getTransportCostSourcesByIds(
  db: PrismaClient,
  params: { companyId: string; repairIds: string[]; tireIds: string[]; jobIds?: string[] }
): Promise<TransportCostSource[]> {
  const jobIds = params.jobIds ?? []
  const [repairs, tires, jobs] = await Promise.all([
    params.repairIds.length
      ? db.transportRepairLog.findMany({
          where: { companyId: params.companyId, id: { in: params.repairIds } },
          include: { vehicle: vehicleSelect },
        })
      : Promise.resolve([]),
    params.tireIds.length
      ? db.transportTireLog.findMany({
          where: { companyId: params.companyId, id: { in: params.tireIds } },
          include: { vehicle: vehicleSelect },
        })
      : Promise.resolve([]),
    jobIds.length
      ? db.transportJob.findMany({
          where: { companyId: params.companyId, id: { in: jobIds } },
          include: jobInclude,
        })
      : Promise.resolve([]),
  ])
  return [...repairs.map(mapRepair), ...tires.map(mapTire), ...jobs.map(mapJob)]
}
