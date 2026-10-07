import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"

/** Transport jobs are shared across the company. A grant on any branch covers every job. */
export function canTransportJobs(roles: UserRole[], action: Action): boolean {
  if (isAdminInAnyBranch(roles)) {
    const admin = roles.find((role) => role.roleName === "Admin")
    if (admin && hasPermission(roles, admin.branchId, "transport_jobs", action)) return true
  }
  return getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "transport_jobs", action))
}
