import type { Prisma, PrismaClient } from "@prisma/client"

/**
 * Read-only asset lookup for other modules (e.g. fuel dispensing).
 * No RBAC here: the calling module has already checked its own permission and branch scope.
 */

const BLOCKED_STATUSES = ["RETIRED", "DISPOSED"] as const

export type AssetLookupRow = {
  id: string
  branchId: string
  code: string
  name: string
  typeName: string
  status: string
  fuelMeterType: "ODOMETER" | "HOUR_METER" | "NONE"
}

const lookupSelect = {
  id: true,
  branchId: true,
  code: true,
  name: true,
  status: true,
  fuelMeterType: true,
  type: { select: { name: true } },
} satisfies Prisma.AssetSelect

function toRow(row: Prisma.AssetGetPayload<{ select: typeof lookupSelect }>): AssetLookupRow {
  return {
    id: row.id,
    branchId: row.branchId,
    code: row.code,
    name: row.name,
    typeName: row.type.name,
    status: row.status,
    fuelMeterType: row.fuelMeterType,
  }
}

/** Active, in-service assets of one branch. */
export async function lookupBranchAssets(
  db: PrismaClient,
  params: { companyId: string; branchId: string; search?: string | null; take?: number }
): Promise<AssetLookupRow[]> {
  const where: Prisma.AssetWhereInput = {
    companyId: params.companyId,
    branchId: params.branchId,
    deletedAt: null,
    isActive: true,
    status: { notIn: [...BLOCKED_STATUSES] },
  }
  const q = params.search?.trim()
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
    ]
  }
  const rows = await db.asset.findMany({
    where,
    select: lookupSelect,
    orderBy: [{ code: "asc" }],
    take: Math.min(Math.max(params.take ?? 200, 1), 500),
  })
  return rows.map(toRow)
}

/** One asset if it is active and in service; null otherwise. */
export async function findActiveAsset(
  db: PrismaClient | Prisma.TransactionClient,
  params: { companyId: string; id: string }
): Promise<AssetLookupRow | null> {
  const row = await db.asset.findFirst({
    where: {
      id: params.id,
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      status: { notIn: [...BLOCKED_STATUSES] },
    },
    select: lookupSelect,
  })
  return row ? toRow(row) : null
}
