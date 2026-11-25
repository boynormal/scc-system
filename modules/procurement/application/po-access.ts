import type { Prisma } from "@prisma/client"
import { ForbiddenError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"

export type PurchaseAction = Extract<Action, "create" | "read" | "update" | "delete">

const NO_BRANCH = "00000000-0000-0000-0000-000000000000"

export function canPurchaseAnywhere(roles: UserRole[], action: PurchaseAction): boolean {
  return getBranchIds(roles).some((bid) => hasPermission(roles, bid, "purchase_orders", action))
}

export function assertPurchaseAnywhere(roles: UserRole[], action: PurchaseAction) {
  if (!canPurchaseAnywhere(roles, action)) throw new ForbiddenError()
}

export function assertPurchaseInBranch(roles: UserRole[], branchId: string, action: PurchaseAction) {
  if (!hasPermission(roles, branchId, "purchase_orders", action)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขานี้")
  }
}

/** null = every branch of the company (admin); otherwise the branch ids allowed for the action. */
export function purchaseBranchScope(roles: UserRole[], action: PurchaseAction): string[] | null {
  if (isAdminInAnyBranch(roles) && canPurchaseAnywhere(roles, action)) return null
  return getBranchIds(roles).filter((bid) => hasPermission(roles, bid, "purchase_orders", action))
}

export function canPurchaseInBranch(roles: UserRole[], branchId: string, action: PurchaseAction): boolean {
  const scope = purchaseBranchScope(roles, action)
  return scope === null || scope.includes(branchId)
}

export function purchaseBranchWhere(
  roles: UserRole[],
  action: PurchaseAction,
  requested?: string | null
): string | Prisma.StringFilter {
  const scope = purchaseBranchScope(roles, action)
  if (requested) {
    if (scope && !scope.includes(requested)) return NO_BRANCH
    return requested
  }
  if (!scope) return { not: NO_BRANCH }
  return { in: scope.length ? scope : [NO_BRANCH] }
}
