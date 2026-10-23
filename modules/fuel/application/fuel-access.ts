import type { Prisma } from "@prisma/client"
import { ForbiddenError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"

export type FuelAction = Extract<Action, "create" | "read" | "update" | "delete" | "approve">

const NO_BRANCH = "00000000-0000-0000-0000-000000000000"

export function canFuelAnywhere(roles: UserRole[], action: FuelAction): boolean {
  return getBranchIds(roles).some((bid) => hasPermission(roles, bid, "fuel", action))
}

export function canFuelInBranch(roles: UserRole[], branchId: string, action: FuelAction): boolean {
  return hasPermission(roles, branchId, "fuel", action)
}

export function assertFuelAnywhere(roles: UserRole[], action: FuelAction) {
  if (!canFuelAnywhere(roles, action)) throw new ForbiddenError()
}

export function assertFuelInBranch(roles: UserRole[], branchId: string, action: FuelAction) {
  if (!canFuelInBranch(roles, branchId, action)) throw new ForbiddenError("ไม่มีสิทธิ์ในสาขานี้")
}

/** null = every branch of the company (admin); otherwise the branch ids allowed for the action. */
export function fuelBranchScope(roles: UserRole[], action: FuelAction): string[] | null {
  if (isAdminInAnyBranch(roles) && canFuelAnywhere(roles, action)) return null
  return getBranchIds(roles).filter((bid) => hasPermission(roles, bid, "fuel", action))
}

/** `branchId` filter for a where clause, honoring an optional requested branch. */
export function fuelBranchWhere(
  roles: UserRole[],
  action: FuelAction,
  requested?: string | null
): string | Prisma.StringFilter {
  const scope = fuelBranchScope(roles, action)
  if (requested) {
    if (scope && !scope.includes(requested)) return NO_BRANCH
    return requested
  }
  if (!scope) return { not: NO_BRANCH }
  return { in: scope.length ? scope : [NO_BRANCH] }
}
