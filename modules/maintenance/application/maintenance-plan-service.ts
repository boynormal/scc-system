import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { permissionCoversBranch } from "@/shared/permissions/branch-sharing"
import type { UserRole } from "@/lib/permissions"
import { readableBranchIds } from "@/modules/maintenance/application/branch-scope"
import { generatePmForPlan } from "@/modules/maintenance/application/pm-generator"
import { loadPmAsset } from "@/modules/maintenance/application/pm-asset-options"
import {
  targetAssetSelect,
  targetBranchId,
  targetMachineSelect,
  targetScopeWhere,
} from "@/modules/maintenance/application/pm-target"

export const createMaintenancePlanSchema = z.object({
  assetId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  frequencyUnit: z.enum(["day", "week", "month", "quarter", "year", "runtime_hour"]),
  frequencyValue: z.coerce.number().int().min(1),
  estimatedDurationMin: z.coerce.number().int().min(1).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).default(7),
  templateIds: z.array(z.string().uuid()).max(20).optional(),
})

export const updateMaintenancePlanSchema = z.object({
  assetId: z.string().uuid().optional(),
  /** ใช้ได้เฉพาะแผนเดิมที่ยังไม่ผูกทรัพย์สิน */
  machineId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  frequencyUnit: z.enum(["day", "week", "month", "quarter", "year", "runtime_hour"]).optional(),
  frequencyValue: z.coerce.number().int().min(1).optional(),
  estimatedDurationMin: z.coerce.number().int().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  templateIds: z.array(z.string().uuid()).max(20).optional(),
})

export type CreateMaintenancePlanInput = z.infer<typeof createMaintenancePlanSchema>
export type UpdateMaintenancePlanInput = z.infer<typeof updateMaintenancePlanSchema>

const RUNTIME_NOT_SUPPORTED = "ยังไม่รองรับความถี่ตามชั่วโมงรัน" as const
const ASSET_NOT_ENABLED = "ทรัพย์สินนี้ยังไม่ได้เปิดเข้าแผนซ่อมบำรุง หรือถูกปิดใช้/ปลดระวางแล้ว" as const

const planTargetInclude = {
  machine: { select: targetMachineSelect },
  asset: { select: targetAssetSelect },
} as const

/** แม่แบบที่ปิดใช้แล้วยังคงผูกกับแผนเดิมได้ แต่ผูกเพิ่มใหม่ไม่ได้ */
async function validateTemplateIds(
  db: PrismaClient,
  companyId: string,
  templateIds: string[] | undefined,
  planId?: string
) {
  const ids = [...new Set(templateIds ?? [])]
  if (ids.length === 0) return { ok: true as const, ids }
  const found = await db.checklistTemplate.count({
    where: {
      id: { in: ids },
      companyId,
      OR: [
        { isActive: true },
        ...(planId ? [{ planChecklistTemplates: { some: { planId } } }] : []),
      ],
    },
  })
  if (found !== ids.length) return { ok: false as const, error: "Invalid checklist template" as const }
  return { ok: true as const, ids }
}

export async function listMaintenancePlans(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    machineId?: string | null
    assetId?: string | null
    isActive?: string | null
  }
) {
  const scope = readableBranchIds(params.roles, "maintenance_plans")
  if (scope !== "all" && scope.length === 0) return []
  return db.maintenancePlan.findMany({
    where: {
      AND: [targetScopeWhere(params.companyId, scope)],
      ...(params.machineId && { machineId: params.machineId }),
      ...(params.assetId && { assetId: params.assetId }),
      ...(params.isActive !== null && params.isActive !== undefined && { isActive: params.isActive === "true" }),
    },
    include: {
      ...planTargetInclude,
      type: { select: { id: true, name: true, code: true, color: true } },
      _count: { select: { schedules: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createMaintenancePlan(
  db: PrismaClient,
  params: { userId: string; companyId: string; roles: UserRole[]; input: CreateMaintenancePlanInput }
) {
  const asset = await loadPmAsset(db, params.companyId, params.input.assetId)
  if (!asset) return { error: ASSET_NOT_ENABLED, status: 400 as const }
  if (!permissionCoversBranch(params.roles, "maintenance_plans", "create", asset.branchId, false)) {
    return { error: "Forbidden" as const, status: 403 as const }
  }
  const type = await db.maintenanceType.findFirst({
    where: { id: params.input.typeId, companyId: params.companyId },
    select: { id: true },
  })
  if (!type) return { error: "Invalid maintenance type" as const, status: 400 as const }

  const { startDate, endDate, templateIds, ...rest } = params.input
  if (rest.frequencyUnit === "runtime_hour") return { error: RUNTIME_NOT_SUPPORTED, status: 400 as const }
  const templates = await validateTemplateIds(db, params.companyId, templateIds)
  if (!templates.ok) return { error: templates.error, status: 400 as const }

  const plan = await db.$transaction(
    async (tx) => {
      const created = await tx.maintenancePlan.create({
        data: {
          ...rest,
          machineId: asset.machineId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          isActive: true,
          createdBy: params.userId,
        },
      })
      if (templates.ids.length > 0) {
        await tx.planChecklistTemplate.createMany({
          data: templates.ids.map((templateId) => ({ planId: created.id, templateId })),
        })
      }
      await generatePmForPlan(tx, { planId: created.id, today: new Date(), userId: params.userId })
      return created
    },
    { timeout: 60_000 }
  )

  return plan
}

async function findScopedPlan(db: PrismaClient, companyId: string, id: string) {
  return db.maintenancePlan.findFirst({
    where: { id, AND: [targetScopeWhere(companyId, "all")] },
    include: planTargetInclude,
  })
}

export async function getMaintenancePlanById(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[] }
) {
  const plan = await findScopedPlan(db, params.companyId, params.id)
  if (!plan) return null
  const branchId = targetBranchId(plan)
  if (!branchId || !permissionCoversBranch(params.roles, "maintenance_plans", "read", branchId, false)) {
    return { error: "Forbidden" as const, status: 403 as const }
  }
  return db.maintenancePlan.findFirst({
    where: { id: params.id },
    include: {
      ...planTargetInclude,
      type: { select: { id: true, name: true, code: true, color: true } },
      planChecklistTemplates: { select: { templateId: true } },
    },
  })
}

export async function updateMaintenancePlan(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; input: UpdateMaintenancePlanInput }
) {
  const plan = await findScopedPlan(db, params.companyId, params.id)
  if (!plan) return null
  const branchId = targetBranchId(plan)
  if (!branchId || !permissionCoversBranch(params.roles, "maintenance_plans", "update", branchId, false)) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const { assetId, machineId, startDate, endDate, description, estimatedDurationMin, templateIds, ...rest } =
    params.input
  const target: { assetId?: string; machineId?: string | null } = {}
  if (assetId && assetId !== plan.assetId) {
    const asset = await loadPmAsset(db, params.companyId, assetId)
    if (!asset) return { error: ASSET_NOT_ENABLED, status: 400 as const }
    if (!permissionCoversBranch(params.roles, "maintenance_plans", "update", asset.branchId, false)) {
      return { error: "Forbidden" as const, status: 403 as const }
    }
    target.assetId = asset.id
    target.machineId = asset.machineId
  } else if (machineId && !plan.assetId && !assetId) {
    const machine = await db.machine.findFirst({
      where: { id: machineId, deletedAt: null, branch: { companyId: params.companyId } },
      select: { branchId: true },
    })
    if (!machine) return { error: "Invalid machine" as const, status: 400 as const }
    if (!permissionCoversBranch(params.roles, "maintenance_plans", "update", machine.branchId, false)) {
      return { error: "Forbidden" as const, status: 403 as const }
    }
    target.machineId = machineId
  }

  if (rest.frequencyUnit === "runtime_hour" && plan.frequencyUnit !== "runtime_hour") {
    return { error: RUNTIME_NOT_SUPPORTED, status: 400 as const }
  }
  const templates =
    templateIds === undefined ? null : await validateTemplateIds(db, params.companyId, templateIds, params.id)
  if (templates && !templates.ok) return { error: templates.error, status: 400 as const }

  return db.$transaction(async (tx) => {
    const updated = await tx.maintenancePlan.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...target,
        description: description === "" ? null : description,
        estimatedDurationMin: Number.isNaN(estimatedDurationMin) ? null : estimatedDurationMin,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : endDate === "" ? null : undefined,
      },
    })
    if (templates) {
      await tx.planChecklistTemplate.deleteMany({
        where: { planId: params.id, templateId: { notIn: templates.ids } },
      })
      await tx.planChecklistTemplate.createMany({
        data: templates.ids.map((templateId) => ({ planId: params.id, templateId })),
        skipDuplicates: true,
      })
    }
    return updated
  })
}

export async function deactivateMaintenancePlan(
  db: PrismaClient,
  params: { id: string; companyId: string; roles: UserRole[]; userId: string; ipAddress?: string | null; userAgent?: string | null }
) {
  const found = await findScopedPlan(db, params.companyId, params.id)
  if (!found) return null
  const branchId = targetBranchId(found)
  const plan = { ...found, asset: undefined, machine: undefined }
  if (!branchId || !permissionCoversBranch(params.roles, "maintenance_plans", "delete", branchId, false)) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  await db.$transaction([
    db.maintenancePlan.update({ where: { id: params.id }, data: { isActive: false } }),
    db.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "maintenance_plans",
        recordId: params.id,
        action: "delete",
        oldValues: JSON.parse(JSON.stringify(plan)),
        newValues: JSON.parse(JSON.stringify({ ...plan, isActive: false })),
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    }),
  ])

  return { success: true }
}
