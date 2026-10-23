import { getBranchIds, hasPermission, isAdminInAnyBranch, type Resource, type UserRole } from "@/lib/permissions"

/** "all" means every branch in the company. An empty list means no read access. */
export function readableBranchIds(roles: UserRole[], resource: Resource): "all" | string[] {
  const ids = getBranchIds(roles)
  if (isAdminInAnyBranch(roles) && hasPermission(roles, ids[0] ?? "admin", resource, "read")) {
    return "all"
  }
  return ids.filter((id) => hasPermission(roles, id, resource, "read"))
}
