import type { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { getBranchIds, hasPermission, type UserRole } from "@/lib/permissions"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"

export const updateNavPreferencesSchema = z.object({
  hiddenModuleIds: z.array(z.string()).optional(),
  orderOverrides: z.record(z.number()).optional(),
  pinnedModuleIds: z.array(z.string()).optional(),
  hiddenDepartmentIds: z.array(z.string()).optional(),
  departmentOrderOverrides: z.record(z.number()).optional(),
})

export async function getNavPreferences(db: PrismaClient, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  })

  return parseCompanyNavPreferences(company?.settings ?? null)
}

export async function updateNavPreferences(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: z.infer<typeof updateNavPreferencesSchema> }
) {
  const canUpdate = getBranchIds(params.roles).some((branchId) =>
    hasPermission(params.roles, branchId, "settings", "update")
  )
  if (!canUpdate) {
    return { error: "Forbidden" as const, status: 403 as const }
  }

  const company = await db.company.findUnique({
    where: { id: params.companyId },
    select: { settings: true },
  })

  const existing =
    company?.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
      ? { ...(company.settings as Record<string, unknown>) }
      : {}

  const prevNav =
    existing.nav && typeof existing.nav === "object" && !Array.isArray(existing.nav)
      ? { ...(existing.nav as Record<string, unknown>) }
      : {}

  const nextNav: Record<string, unknown> = { ...prevNav }
  if (params.input.hiddenModuleIds !== undefined) {
    nextNav.hiddenModuleIds = params.input.hiddenModuleIds
  }
  if (params.input.orderOverrides !== undefined) {
    const prevOrder =
      prevNav.orderOverrides && typeof prevNav.orderOverrides === "object" && !Array.isArray(prevNav.orderOverrides)
        ? (prevNav.orderOverrides as Record<string, number>)
        : {}
    nextNav.orderOverrides = { ...prevOrder, ...params.input.orderOverrides }
  }
  if (params.input.pinnedModuleIds !== undefined) {
    nextNav.pinnedModuleIds = params.input.pinnedModuleIds
  }
  if (params.input.hiddenDepartmentIds !== undefined) {
    nextNav.hiddenDepartmentIds = params.input.hiddenDepartmentIds
  }
  if (params.input.departmentOrderOverrides !== undefined) {
    const prevDepartmentOrder =
      prevNav.departmentOrderOverrides &&
      typeof prevNav.departmentOrderOverrides === "object" &&
      !Array.isArray(prevNav.departmentOrderOverrides)
        ? (prevNav.departmentOrderOverrides as Record<string, number>)
        : {}
    nextNav.departmentOrderOverrides = {
      ...prevDepartmentOrder,
      ...params.input.departmentOrderOverrides,
    }
  }

  const newSettings = { ...existing, nav: nextNav }

  await db.company.update({
    where: { id: params.companyId },
    data: { settings: newSettings as object },
  })

  return { data: parseCompanyNavPreferences(newSettings) }
}
