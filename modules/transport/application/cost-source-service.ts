import type { PrismaClient } from "@prisma/client"

export type TransportCostSourceType = "TRANSPORT_REPAIR" | "TRANSPORT_TIRE"

export type TransportCostSource = {
  sourceType: TransportCostSourceType
  /** Upstream document id (repair/tire log id). */
  sourceId: string
  branchId: string
  date: string
  vehicleId: string
  vehicleLabel: string
  amount: number
  paymentMethod: "cash" | "credit" | null
  description: string
}

const TAKE_LIMIT = 300

type RepairRow = {
  id: string
  branchId: string
  reportedAt: Date
  vehicleId: string
  repairCost: unknown
  paymentMethod: "cash" | "credit" | null
  symptom: string
  vehicle: { id: string; plateNumber: string } | null
}

type TireRow = {
  id: string
  branchId: string
  workDate: Date
  vehicleId: string
  cost: unknown
  paymentMethod: "cash" | "credit" | null
  vehicle: { id: string; plateNumber: string } | null
}

function mapRepair(r: RepairRow): TransportCostSource {
  return {
    sourceType: "TRANSPORT_REPAIR",
    sourceId: r.id,
    branchId: r.branchId,
    date: r.reportedAt.toISOString(),
    vehicleId: r.vehicleId,
    vehicleLabel: r.vehicle?.plateNumber ?? "-",
    amount: r.repairCost != null ? Number(r.repairCost) : 0,
    paymentMethod: r.paymentMethod ?? null,
    description: `ค่าซ่อม: ${r.symptom}`.slice(0, 255),
  }
}

function mapTire(t: TireRow): TransportCostSource {
  return {
    sourceType: "TRANSPORT_TIRE",
    sourceId: t.id,
    branchId: t.branchId,
    date: t.workDate.toISOString(),
    vehicleId: t.vehicleId,
    vehicleLabel: t.vehicle?.plateNumber ?? "-",
    amount: t.cost != null ? Number(t.cost) : 0,
    paymentMethod: t.paymentMethod ?? null,
    description: "ค่ายาง",
  }
}

const vehicleSelect = { select: { id: true, plateNumber: true } } as const

/**
 * Read-only list of transport cost entries (repair + tire logs with a cost > 0),
 * exposed so the Finance module can reference them without querying transport
 * tables directly. Callers are responsible for permission checks; pass
 * `branchIds = null` for admin (all branches) or a scoped list otherwise.
 */
export async function listTransportCostSources(
  db: PrismaClient,
  params: { companyId: string; branchIds: string[] | null }
): Promise<TransportCostSource[]> {
  const branchWhere =
    params.branchIds === null
      ? {}
      : {
          branchId: {
            in: params.branchIds.length ? params.branchIds : ["00000000-0000-0000-0000-000000000000"],
          },
        }

  const [repairs, tires] = await Promise.all([
    db.transportRepairLog.findMany({
      where: { companyId: params.companyId, repairCost: { gt: 0 }, ...branchWhere },
      include: { vehicle: vehicleSelect },
      orderBy: { reportedAt: "desc" },
      take: TAKE_LIMIT,
    }),
    db.transportTireLog.findMany({
      where: { companyId: params.companyId, cost: { gt: 0 }, ...branchWhere },
      include: { vehicle: vehicleSelect },
      orderBy: { workDate: "desc" },
      take: TAKE_LIMIT,
    }),
  ])

  return [...repairs.map(mapRepair), ...tires.map(mapTire)].sort((a, b) => (a.date < b.date ? 1 : -1))
}

/**
 * Fetch specific transport cost sources by their upstream ids. Used by Finance to
 * re-derive the authoritative amount when linking a source to an expense line
 * (so a client cannot tamper with a locked amount). Only entries with cost > 0
 * are returned; missing/zero-cost ids are simply absent from the result.
 */
export async function getTransportCostSourcesByIds(
  db: PrismaClient,
  params: { companyId: string; repairIds: string[]; tireIds: string[] }
): Promise<TransportCostSource[]> {
  const [repairs, tires] = await Promise.all([
    params.repairIds.length
      ? db.transportRepairLog.findMany({
          where: { companyId: params.companyId, id: { in: params.repairIds }, repairCost: { gt: 0 } },
          include: { vehicle: vehicleSelect },
        })
      : Promise.resolve([]),
    params.tireIds.length
      ? db.transportTireLog.findMany({
          where: { companyId: params.companyId, id: { in: params.tireIds }, cost: { gt: 0 } },
          include: { vehicle: vehicleSelect },
        })
      : Promise.resolve([]),
  ])
  return [...repairs.map(mapRepair), ...tires.map(mapTire)]
}
