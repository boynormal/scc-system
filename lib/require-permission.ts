import { NextResponse } from "next/server"
import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type Action,
  type Resource,
  type UserRole,
} from "@/lib/permissions"

/**
 * Returns a 403 NextResponse when the user lacks the given permission
 * in any of their branches (Admin still goes through hasPermission).
 */
export function forbidUnlessPermission(
  roles: UserRole[],
  resource: Resource,
  action: Action
): NextResponse | null {
  const allowed =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, resource, action))

  if (allowed) return null

  return NextResponse.json(
    { error: { message: "Forbidden", code: "FORBIDDEN" } },
    { status: 403 }
  )
}
