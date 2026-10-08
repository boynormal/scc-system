import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { getBranchIds, hasPermission, type UserRole } from "@/lib/permissions"
import {
  BRANCH_SHARE_MODULES,
  parseBranchSharing,
  type BranchShareFlags,
  type BranchShareModule,
  type BranchSharingSettings,
} from "@/shared/permissions/branch-sharing"

const flagsSchema = z.object({
  view: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
  create: z.boolean(),
  approve: z.boolean().optional(),
})

export const updateBranchSharingSchema = z.object({
  transport_jobs: flagsSchema.optional(),
  assets: flagsSchema.optional(),
  machines: flagsSchema.optional(),
  work_orders: flagsSchema.optional(),
  due_dates: flagsSchema.optional(),
  finance: flagsSchema.optional(),
  personnel: flagsSchema.optional(),
})

function canUpdateSettings(roles: UserRole[]) {
  return getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "settings", "update"))
}

function storedFlags(moduleId: BranchShareModule, flags: BranchShareFlags) {
  const row: Record<string, boolean> = {
    view: flags.view,
    edit: flags.edit,
    delete: flags.delete,
    create: flags.create,
  }
  if (moduleId === "finance") row.approve = flags.approve
  return row
}

export async function getBranchSharing(db: PrismaClient, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  })
  return parseBranchSharing(company?.settings ?? null)
}

export async function updateBranchSharing(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    input: z.infer<typeof updateBranchSharingSchema>
  }
): Promise<{ data: BranchSharingSettings } | { error: "Forbidden"; status: 403 }> {
  if (!canUpdateSettings(params.roles)) {
    return { error: "Forbidden", status: 403 }
  }

  const company = await db.company.findUnique({
    where: { id: params.companyId },
    select: { settings: true },
  })
  const existing =
    company?.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
      ? { ...(company.settings as Record<string, unknown>) }
      : {}

  const current = parseBranchSharing(existing)
  const next: BranchSharingSettings = { ...current }
  for (const moduleId of BRANCH_SHARE_MODULES) {
    const patch = params.input[moduleId]
    if (!patch) continue
    next[moduleId] = {
      view: patch.view,
      edit: patch.edit,
      delete: patch.delete,
      create: patch.create,
      approve: moduleId === "finance" ? Boolean(patch.approve) : false,
    }
  }

  const branchSharing: Record<string, Record<string, boolean>> = {}
  for (const moduleId of BRANCH_SHARE_MODULES) {
    branchSharing[moduleId] = storedFlags(moduleId, next[moduleId])
  }

  await db.company.update({
    where: { id: params.companyId },
    data: { settings: { ...existing, branchSharing } as object },
  })

  return { data: next }
}
