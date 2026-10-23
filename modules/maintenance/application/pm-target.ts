import { PM_BLOCKED_ASSET_STATUSES } from "@/modules/assets/application/asset-maintenance-service"

/**
 * เป้าหมายของแผน รอบ และใบงาน: ทรัพย์สินเป็นหลัก ถ้าไม่มีทรัพย์สินใช้เครื่องจักร (แถวก่อน Phase 3.5)
 */
export const targetAssetSelect = {
  id: true,
  code: true,
  name: true,
  branchId: true,
  status: true,
  isActive: true,
  deletedAt: true,
  maintenancePmEnabled: true,
  branch: { select: { id: true, name: true } },
} as const

export const targetMachineSelect = {
  id: true,
  code: true,
  name: true,
  branchId: true,
  deletedAt: true,
  branch: { select: { id: true, name: true } },
} as const

type TargetAsset = {
  id: string
  code: string
  name: string
  branchId: string
  status?: string
  isActive?: boolean
  deletedAt?: Date | null
  maintenancePmEnabled?: boolean
  branch?: { name: string }
}

type TargetMachine = {
  id: string
  code: string
  name: string
  branchId: string
  deletedAt?: Date | null
  branch?: { name: string }
}

export type TargetRow = { asset?: TargetAsset | null; machine?: TargetMachine | null }

export type PmTarget = {
  kind: "asset" | "machine"
  id: string
  code: string
  name: string
  branchId: string
  branchName: string | null
  assetId: string | null
  machineId: string | null
}

export function resolveTarget(row: TargetRow): PmTarget | null {
  if (row.asset) {
    return {
      kind: "asset",
      id: row.asset.id,
      code: row.asset.code,
      name: row.asset.name,
      branchId: row.asset.branchId,
      branchName: row.asset.branch?.name ?? null,
      assetId: row.asset.id,
      machineId: row.machine?.id ?? null,
    }
  }
  if (row.machine) {
    return {
      kind: "machine",
      id: row.machine.id,
      code: row.machine.code,
      name: row.machine.name,
      branchId: row.machine.branchId,
      branchName: row.machine.branch?.name ?? null,
      assetId: null,
      machineId: row.machine.id,
    }
  }
  return null
}

export function targetHref(target: PmTarget): string {
  return target.kind === "asset" ? `/assets/${target.id}` : `/machines/${target.id}`
}

export function targetBranchId(row: TargetRow): string | null {
  return row.asset?.branchId ?? row.machine?.branchId ?? null
}

/** ทรัพย์สินที่ปิดสวิตช์ ถูกลบ ปิดใช้ หรือปลดระวาง ไม่ได้รอบใหม่ */
export function assetPmInactive(asset: TargetAsset): boolean {
  return (
    !!asset.deletedAt ||
    asset.isActive === false ||
    asset.maintenancePmEnabled === false ||
    (PM_BLOCKED_ASSET_STATUSES as readonly string[]).includes(asset.status ?? "")
  )
}

export type TargetInactiveReason = "asset_inactive" | "machine_deleted"

export function targetInactiveReason(row: TargetRow): TargetInactiveReason | null {
  if (row.asset) return assetPmInactive(row.asset) ? "asset_inactive" : null
  if (row.machine?.deletedAt) return "machine_deleted"
  return null
}

/** where ของแผนหรือรอบในบริษัท โดยกรองสาขาตามเป้าหมาย */
export function targetScopeWhere(companyId: string, scope: "all" | string[]) {
  const branch = scope === "all" ? {} : { id: { in: scope } }
  const branchIds = scope === "all" ? {} : { branchId: { in: scope } }
  return {
    OR: [
      { asset: { companyId, ...branchIds } },
      { assetId: null, machine: { branch: { companyId, ...branch } } },
    ],
  }
}

/** where ของแผนที่ยังสร้างรอบได้ */
export function activeTargetWhere() {
  return {
    OR: [
      {
        asset: {
          deletedAt: null,
          isActive: true,
          maintenancePmEnabled: true,
          status: { notIn: [...PM_BLOCKED_ASSET_STATUSES] },
        },
      },
      { assetId: null, machine: { deletedAt: null } },
    ],
  }
}
