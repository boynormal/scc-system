import type { Prisma } from "@prisma/client"
import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type Action,
  type UserRole,
} from "@/lib/permissions"
import { permissionCoversBranch, type BranchShareFlags } from "@/shared/permissions/branch-sharing"
import { EMPTY_ID } from "./rules"

export function canDocuments(roles: UserRole[], action: Action): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "documents", action))
  )
}

export function canDocumentMasters(roles: UserRole[], action: Action): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "document_masters", action))
  )
}

export function canTouchDocument(
  roles: UserRole[],
  action: "create" | "read" | "update" | "delete",
  branchId: string | null,
  share: BranchShareFlags
): boolean {
  if (!canDocuments(roles, action)) return false
  if (branchId == null) return true
  const shared =
    action === "read" ? share.view : action === "update" ? share.edit : action === "delete" ? share.delete : share.create
  return permissionCoversBranch(roles, "documents", action, branchId, shared)
}

/**
 * Company-wide documents (branchId null) are visible to anyone who can read the module.
 * Branch documents follow the user's branches unless branch sharing for view is on.
 */
export function documentWhere(params: {
  companyId: string
  roles: UserRole[]
  shareView: boolean
  branchFilter?: string | null
  includeDeleted?: boolean
}): Prisma.DocCenterDocumentWhereInput {
  const base: Prisma.DocCenterDocumentWhereInput = {
    companyId: params.companyId,
    ...(params.includeDeleted ? {} : { deletedAt: null }),
  }
  const seeAllBranches = isAdminInAnyBranch(params.roles) || params.shareView
  const allowed = getBranchIds(params.roles)
  const visible: Prisma.DocCenterDocumentWhereInput = seeAllBranches
    ? {}
    : {
        OR: [{ branchId: null }, { branchId: { in: allowed.length ? allowed : [EMPTY_ID] } }],
      }

  if (params.branchFilter === "company") {
    return { AND: [base, visible, { branchId: null }] }
  }
  if (params.branchFilter) {
    if (!seeAllBranches && !allowed.includes(params.branchFilter)) return { id: EMPTY_ID }
    return { AND: [base, visible, { branchId: params.branchFilter }] }
  }
  return { AND: [base, visible] }
}
