import type { Prisma, PrismaClient } from "@prisma/client"
import type { Resource, UserRole } from "@/lib/permissions"
import { permissionCoversBranch } from "@/shared/permissions/branch-sharing"
import { PM_BLOCKED_ASSET_STATUSES } from "@/modules/assets/application/asset-maintenance-service"
import { assetPmInactive } from "@/modules/maintenance/application/pm-target"

type Db = PrismaClient | Prisma.TransactionClient

const pmAssetSelect = {
  id: true,
  code: true,
  name: true,
  branchId: true,
  status: true,
  isActive: true,
  deletedAt: true,
  maintenancePmEnabled: true,
  type: { select: { name: true } },
  branch: { select: { name: true } },
  machine: { select: { id: true, code: true, name: true, deletedAt: true } },
  vehicle: { select: { id: true, plateNumber: true, name: true } },
} as const

export type PmAsset = {
  id: string
  code: string
  name: string
  branchId: string
  branchName: string
  typeName: string
  /** เครื่องจักรที่ผูกและยังไม่ถูกลบ ใบงานจะได้ machineId นี้ด้วย */
  machineId: string | null
  link: { kind: "machine" | "vehicle"; id: string; code: string; name: string } | null
}

function toPmAsset(row: Prisma.AssetGetPayload<{ select: typeof pmAssetSelect }>): PmAsset {
  const machine = row.machine && !row.machine.deletedAt ? row.machine : null
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branchId: row.branchId,
    branchName: row.branch.name,
    typeName: row.type.name,
    machineId: machine?.id ?? null,
    link: machine
      ? { kind: "machine", id: machine.id, code: machine.code, name: machine.name }
      : row.vehicle
        ? { kind: "vehicle", id: row.vehicle.id, code: row.vehicle.plateNumber, name: row.vehicle.name }
        : null,
  }
}

/** ทรัพย์สินที่เปิด "เข้าแผนซ่อมบำรุง" และยังใช้ได้ คืน null ถ้าใช้ไม่ได้ */
export async function loadPmAsset(db: Db, companyId: string, assetId: string): Promise<PmAsset | null> {
  const row = await db.asset.findFirst({ where: { id: assetId, companyId }, select: pmAssetSelect })
  if (!row || assetPmInactive(row)) return null
  return toPmAsset(row)
}

const usableAssetWhere = {
  deletedAt: null,
  isActive: true,
  status: { notIn: [...PM_BLOCKED_ASSET_STATUSES] },
} satisfies Prisma.AssetWhereInput

/** ทรัพย์สินที่ยังใช้งานสำหรับแจ้งซ่อม ไม่ต้องเปิดสวิตช์ คืน null ถ้าใช้ไม่ได้ */
export async function loadRepairAsset(db: Db, companyId: string, assetId: string): Promise<PmAsset | null> {
  const row = await db.asset.findFirst({ where: { id: assetId, companyId, ...usableAssetWhere }, select: pmAssetSelect })
  return row ? toPmAsset(row) : null
}

/**
 * ตัวเลือกในฟอร์ม: เฉพาะสาขาที่ผู้ใช้ทำ action นั้นได้
 * แผน PM ต้องเปิดสวิตช์ (`requirePmEnabled`) แจ้งซ่อมใช้ทรัพย์สินที่ยังใช้งานทุกใบ
 */
export async function listPmAssetOptions(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    resource: Resource
    action: "create" | "update"
    includeId?: string | null
    requirePmEnabled?: boolean
  }
) {
  const requirePmEnabled = params.requirePmEnabled ?? true
  const rows = await db.asset.findMany({
    where: {
      companyId: params.companyId,
      OR: [
        { ...usableAssetWhere, ...(requirePmEnabled && { maintenancePmEnabled: true }) },
        ...(params.includeId ? [{ id: params.includeId }] : []),
      ],
    },
    select: pmAssetSelect,
    orderBy: [{ code: "asc" }],
    take: 1000,
  })
  return rows
    .filter((row) =>
      row.id === params.includeId
        ? permissionCoversBranch(params.roles, params.resource, "read", row.branchId, false)
        : permissionCoversBranch(params.roles, params.resource, params.action, row.branchId, false)
    )
    .map(toPmAsset)
}
