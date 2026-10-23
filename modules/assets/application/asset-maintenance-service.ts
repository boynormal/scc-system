import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import { assetWhere } from "./asset-service"

/** สถานะทะเบียนที่เข้าแผนซ่อมบำรุงไม่ได้ */
export const PM_BLOCKED_ASSET_STATUSES = ["RETIRED", "DISPOSED"] as const

export const setAssetMaintenancePmSchema = z.object({ enabled: z.boolean() })

export const linkAssetSchema = z.union([
  z.object({ kind: z.literal("machine"), targetId: z.string().uuid() }),
  z.object({ kind: z.literal("vehicle"), targetId: z.string().uuid() }),
  z.object({ kind: z.null() }),
])

export type LinkAssetInput = z.infer<typeof linkAssetSchema>

export function assetPmBlockReason(asset: {
  isActive: boolean
  deletedAt: Date | null
  status: string
}): string | null {
  if (asset.deletedAt || !asset.isActive) return "ทรัพย์สินนี้ปิดใช้งานอยู่"
  if ((PM_BLOCKED_ASSET_STATUSES as readonly string[]).includes(asset.status)) {
    return "ทรัพย์สินที่ปลดระวางหรือจำหน่ายแล้วเข้าแผนซ่อมบำรุงไม่ได้"
  }
  return null
}

function canAssets(roles: UserRole[], action: "read" | "update"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

async function loadAsset(
  db: PrismaClient | Prisma.TransactionClient,
  params: { companyId: string; roles: UserRole[]; id: string; action: "read" | "update" }
) {
  if (!canAssets(params.roles, params.action)) throw new ForbiddenError()
  const share = await readBranchSharing(db as PrismaClient, params.companyId)
  const companyWide = params.action === "read" ? share.assets.view : share.assets.edit
  const asset = await db.asset.findFirst({
    where: { id: params.id, ...assetWhere(params.companyId, params.roles, null, companyWide) },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      code: true,
      name: true,
      status: true,
      isActive: true,
      deletedAt: true,
      maintenancePmEnabled: true,
      machine: { select: { id: true, code: true, name: true } },
      vehicle: { select: { id: true, plateNumber: true, name: true } },
    },
  })
  if (!asset) throw new NotFoundError("ไม่พบรายการ")
  return asset
}

type LoadedAsset = Awaited<ReturnType<typeof loadAsset>>

function linkOf(asset: Pick<LoadedAsset, "machine" | "vehicle">) {
  if (asset.machine) {
    return { kind: "machine" as const, id: asset.machine.id, code: asset.machine.code, name: asset.machine.name }
  }
  if (asset.vehicle) {
    return { kind: "vehicle" as const, id: asset.vehicle.id, code: asset.vehicle.plateNumber, name: asset.vehicle.name }
  }
  return null
}

export async function getAssetMaintenance(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const asset = await loadAsset(db, { ...params, action: "read" })
  const [machines, vehicles, plans] = await Promise.all([
    db.machine.findMany({
      where: {
        branchId: asset.branchId,
        deletedAt: null,
        OR: [{ assetId: null }, { assetId: asset.id }],
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
      take: 500,
    }),
    db.transportVehicle.findMany({
      where: {
        companyId: asset.companyId,
        branchId: asset.branchId,
        isActive: true,
        OR: [{ assetId: null }, { assetId: asset.id }],
      },
      select: { id: true, plateNumber: true, name: true },
      orderBy: { plateNumber: "asc" },
      take: 500,
    }),
    db.maintenancePlan.findMany({
      where: { assetId: asset.id },
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ])
  return {
    data: {
      enabled: asset.maintenancePmEnabled,
      blockReason: assetPmBlockReason(asset),
      link: linkOf(asset),
      candidates: {
        machines: machines.map((m) => ({ id: m.id, code: m.code, name: m.name })),
        vehicles: vehicles.map((v) => ({ id: v.id, code: v.plateNumber, name: v.name })),
      },
      plans,
    },
  }
}

export async function setAssetMaintenancePm(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; enabled: boolean }
) {
  const asset = await loadAsset(db, { ...params, action: "update" })
  if (params.enabled) {
    const reason = assetPmBlockReason(asset)
    if (reason) throw new ValidationError(reason)
  }
  if (asset.maintenancePmEnabled === params.enabled) return { data: { enabled: params.enabled } }
  await db.$transaction([
    db.asset.update({ where: { id: asset.id }, data: { maintenancePmEnabled: params.enabled } }),
    db.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "assets",
        recordId: asset.id,
        action: "update",
        oldValues: { maintenancePmEnabled: asset.maintenancePmEnabled },
        newValues: { maintenancePmEnabled: params.enabled },
      },
    }),
  ])
  return { data: { enabled: params.enabled } }
}

/** หนึ่งทรัพย์สินผูกได้กับเครื่องจักรหรือรถอย่างใดอย่างหนึ่ง ต้องบริษัทและสาขาเดียวกัน */
export async function linkAssetTarget(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; input: LinkAssetInput }
) {
  const asset = await loadAsset(db, { ...params, action: "update" })
  const before = linkOf(asset)
  const input = params.input

  if (input.kind === "machine") {
    const machine = await db.machine.findFirst({
      where: { id: input.targetId, deletedAt: null, branch: { companyId: params.companyId } },
      select: { id: true, branchId: true, assetId: true },
    })
    if (!machine) throw new ValidationError("ไม่พบเครื่องจักร")
    if (machine.branchId !== asset.branchId) throw new ValidationError("เครื่องจักรต้องอยู่สาขาเดียวกับทรัพย์สิน")
    if (machine.assetId && machine.assetId !== asset.id) throw new ValidationError("เครื่องจักรนี้ผูกกับทรัพย์สินอื่นแล้ว")
  } else if (input.kind === "vehicle") {
    const vehicle = await db.transportVehicle.findFirst({
      where: { id: input.targetId, companyId: params.companyId },
      select: { id: true, branchId: true, assetId: true, isActive: true },
    })
    if (!vehicle || !vehicle.isActive) throw new ValidationError("ไม่พบรถ")
    if (vehicle.branchId !== asset.branchId) throw new ValidationError("รถต้องอยู่สาขาเดียวกับทรัพย์สิน")
    if (vehicle.assetId && vehicle.assetId !== asset.id) throw new ValidationError("รถคันนี้ผูกกับทรัพย์สินอื่นแล้ว")
  }

  const unchanged =
    (input.kind === null && before === null) ||
    (input.kind !== null && before?.kind === input.kind && before.id === input.targetId)
  if (unchanged) return { data: { link: before } }

  await db.$transaction(async (tx) => {
    await tx.machine.updateMany({ where: { assetId: asset.id }, data: { assetId: null } })
    await tx.transportVehicle.updateMany({ where: { assetId: asset.id }, data: { assetId: null } })
    if (input.kind === "machine") {
      await tx.machine.update({ where: { id: input.targetId }, data: { assetId: asset.id } })
    } else if (input.kind === "vehicle") {
      await tx.transportVehicle.update({ where: { id: input.targetId }, data: { assetId: asset.id } })
    }
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "assets",
        recordId: asset.id,
        action: "update",
        oldValues: { link: before },
        newValues: { link: input.kind === null ? null : { kind: input.kind, id: input.targetId } },
      },
    })
  })

  const reloaded = await loadAsset(db, { ...params, action: "read" })
  return { data: { link: linkOf(reloaded) } }
}
