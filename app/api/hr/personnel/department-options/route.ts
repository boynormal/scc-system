import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listPersonnelDepartments } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "hr_personnel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const branchIds = searchParams.getAll("branchId").filter(Boolean)
  const result = await listPersonnelDepartments(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchIds,
  })
  return Response.json(result)
})
