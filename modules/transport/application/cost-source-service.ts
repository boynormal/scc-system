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
  /** Asset linked to the vehicle; `null` when the vehicle has none. */
  assetId: string | null
  assetLabel: string | null
  /** Reference amount only. `null` ≠ `0`. Not an Expense. */
  amount: number | null
  paymentMethod: "cash" | "credit" | null
  /** Human document code when the operational module has one (job / repair / tire number). */
  documentNo: string | null
  /** Readable note only — do not prefix with the document number. */
  description: string | null
}

/** Hydrate open sources in batches so a large `IN` list stays bounded. */
const HYDRATE_CHUNK = 200

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

type VehicleRow = {
  id: string
  plateNumber: string
  asset?: { id: string; code: string; name: string; deletedAt: Date | null } | null
}

function vehicleAsset(vehicle: VehicleRow | null | undefined): { assetId: string | null; assetLabel: string | null } {
  const asset = vehicle?.asset
  if (!asset || asset.deletedAt) return { assetId: null, assetLabel: null }
  return { assetId: asset.id, assetLabel: `${asset.code} — ${asset.name}` }
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
  vehicle: VehicleRow | null
}

type TireRow = {
  id: string
  branchId: string
  workDate: Date
  vehicleId: string
  cost: unknown
  paymentMethod: "cash" | "credit" | null
  tireNumber: string
  vehicle: VehicleRow | null
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
    vehicle: VehicleRow | null
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
    ...vehicleAsset(r.vehicle),
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
    ...vehicleAsset(t.vehicle),
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
    ...vehicleAsset(j.assignment?.vehicle),
    amount: null,
    paymentMethod: null,
    documentNo: j.jobNumber,
    description: customer ? customer.slice(0, 255) : null,
  }
}

const vehicleSelect = {
  select: {
    id: true,
    plateNumber: true,
    asset: { select: { id: true, code: true, name: true, deletedAt: true } },
  },
} as const
const jobInclude = { assignment: { include: { vehicle: vehicleSelect } } } as const

function branchWhere(branchIds: string[] | null) {
  if (branchIds === null) return {}
  return {
    branchId: {
      in: branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"],
    },
  }
}

export type TransportSourceExcludeIds = {
  repairIds?: string[]
  tireIds?: string[]
  jobIds?: string[]
}

/** Drop ids finance already closed. Order of the remaining ids is preserved. */
export function omitExcludedIds(ids: string[], excluded: readonly string[] | undefined): string[] {
  if (!excluded?.length) return ids
  const skip = new Set(excluded)
  return ids.filter((id) => !skip.has(id))
}

function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += HYDRATE_CHUNK) {
    chunks.push(ids.slice(i, i + HYDRATE_CHUNK))
  }
  return chunks
}

/**
 * Finance-ready operational events for the review queue:
 * closed repairs, every tire log, completed jobs.
 * Amount is not an eligibility filter. Callers pass ids already linked or
 * reviewed closed so those rows do not crowd out older open sources.
 * No row cap: every remaining id is hydrated.
 */
export async function listTransportCostSources(
  db: PrismaClient,
  params: {
    companyId: string
    branchIds: string[] | null
    excludeIds?: TransportSourceExcludeIds
  }
): Promise<TransportCostSource[]> {
  const scoped = branchWhere(params.branchIds)
  const exclude = params.excludeIds

  const [repairRows, tireRows, jobRows] = await Promise.all([
    db.transportRepairLog.findMany({
      where: { companyId: params.companyId, status: "closed", ...scoped },
      select: { id: true },
    }),
    db.transportTireLog.findMany({
      where: { companyId: params.companyId, ...scoped },
      select: { id: true },
    }),
    db.transportJob.findMany({
      where: { companyId: params.companyId, status: "completed", ...scoped },
      select: { id: true },
    }),
  ])

  const repairIds = omitExcludedIds(
    repairRows.map((row) => row.id),
    exclude?.repairIds
  )
  const tireIds = omitExcludedIds(
    tireRows.map((row) => row.id),
    exclude?.tireIds
  )
  const jobIds = omitExcludedIds(
    jobRows.map((row) => row.id),
    exclude?.jobIds
  )
  if (repairIds.length + tireIds.length + jobIds.length === 0) return []

  const repairChunks = chunkIds(repairIds)
  const tireChunks = chunkIds(tireIds)
  const jobChunks = chunkIds(jobIds)
  const rounds = Math.max(repairChunks.length, tireChunks.length, jobChunks.length)
  const parts = await Promise.all(
    Array.from({ length: rounds }, (_, index) =>
      getTransportCostSourcesByIds(db, {
        companyId: params.companyId,
        repairIds: repairChunks[index] ?? [],
        tireIds: tireChunks[index] ?? [],
        jobIds: jobChunks[index] ?? [],
      })
    )
  )

  return parts.flat().sort((a, b) => (a.date < b.date ? 1 : -1))
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
