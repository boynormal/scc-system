import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { lookupBranchAssets } from "@/modules/assets"
import { assertFuelAnywhere, assertFuelInBranch } from "./fuel-access"
import { listFuelTypes } from "./fuel-type-service"
import { listFuelBranches, listFuelTanks } from "./fuel-tank-service"
import { lastMeterReadings } from "./fuel-transaction-service"

/** Form options: branches, active tanks, fuel types, suppliers. */
export async function getFuelOptions(db: PrismaClient, params: { companyId: string; roles: UserRole[] }) {
  assertFuelAnywhere(params.roles, "read")
  const [branches, tanks, fuelTypes, suppliers] = await Promise.all([
    listFuelBranches(db, params),
    listFuelTanks(db, { ...params, activeOnly: true }),
    listFuelTypes(db, { ...params, activeOnly: true }),
    db.supplier.findMany({
      where: { companyId: params.companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ])
  return {
    data: {
      branches: branches.data,
      tanks: tanks.data,
      fuelTypes: fuelTypes.data,
      suppliers,
    },
  }
}

/** Assets of a branch that can receive fuel, with their latest meter readings. */
export async function listFuelAssets(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; search?: string | null }
) {
  assertFuelInBranch(params.roles, params.branchId, "read")
  const assets = await lookupBranchAssets(db, {
    companyId: params.companyId,
    branchId: params.branchId,
    search: params.search,
  })
  const meters = await lastMeterReadings(
    db,
    assets.map((a) => a.id)
  )
  return {
    data: assets.map((a) => ({
      ...a,
      lastOdometer: meters.get(a.id)?.odometer ?? null,
      lastHourMeter: meters.get(a.id)?.hourMeter ?? null,
    })),
  }
}
