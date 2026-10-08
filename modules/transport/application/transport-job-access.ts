import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"
import { permissionCoversBranch, readBranchSharing } from "@/shared/permissions/branch-sharing"

const SHARE_ACTION = {
  read: "view",
  update: "edit",
  delete: "delete",
  create: "create",
} as const

type CompanyReader = Parameters<typeof readBranchSharing>[0]

/** True when the user has this transport-jobs action on at least one branch. */
export function canTransportJobs(roles: UserRole[], action: Action): boolean {
  if (isAdminInAnyBranch(roles)) {
    const admin = roles.find((role) => role.roleName === "Admin")
    if (admin && hasPermission(roles, admin.branchId, "transport_jobs", action)) return true
  }
  return getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "transport_jobs", action))
}

export async function transportJobAllowed(
  db: CompanyReader,
  params: { companyId: string; roles: UserRole[]; action: keyof typeof SHARE_ACTION; branchId: string }
): Promise<boolean> {
  const flags = await readBranchSharing(db, params.companyId)
  const shared = flags.transport_jobs[SHARE_ACTION[params.action]]
  return permissionCoversBranch(params.roles, "transport_jobs", params.action, params.branchId, shared)
}

/** Branch ids to keep when view sharing is off. `null` means every branch in the company. */
export async function transportJobListBranchIds(
  db: CompanyReader,
  companyId: string,
  roles: UserRole[]
): Promise<string[] | null> {
  const flags = await readBranchSharing(db, companyId)
  if (flags.transport_jobs.view || isAdminInAnyBranch(roles)) return null
  return getBranchIds(roles)
}
