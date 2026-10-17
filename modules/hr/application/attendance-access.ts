import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"
import { permissionCoversBranch, readBranchSharing, type BranchShareAction } from "@/shared/permissions/branch-sharing"

const SHARE_ACTION: Record<Action, BranchShareAction> = {
  read: "view",
  create: "create",
  update: "edit",
  delete: "delete",
  approve: "approve",
}

export function canAttendanceAnyBranch(roles: UserRole[], action: Action): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", action))
  )
}

/** ตรวจสาขาอยู่ในบริษัท + ผู้ใช้มีสิทธิ์ hr_attendance ที่สาขานั้น (รวม branch sharing ของ personnel) */
export async function assertAttendanceBranch(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string; action: Action }
): Promise<{ id: string; timezone: string; code: string; name: string }> {
  const branch = await db.branch.findFirst({
    where: { id: params.branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true, timezone: true, code: true, name: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")

  const sharing = await readBranchSharing(db, params.companyId)
  const shared = sharing.personnel[SHARE_ACTION[params.action]]
  if (!permissionCoversBranch(params.roles, "hr_attendance", params.action, branch.id, shared)) {
    throw new ForbiddenError()
  }
  return branch
}

/** สาขาที่ผู้ใช้เลือกดูได้ในหน้า attendance */
export async function listAttendanceBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
): Promise<Array<{ id: string; code: string; name: string }>> {
  const branches = await db.branch.findMany({
    where: { companyId: params.companyId, isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  })
  const shared = (await readBranchSharing(db, params.companyId)).personnel.view
  return branches.filter((b) => permissionCoversBranch(params.roles, "hr_attendance", "read", b.id, shared))
}
