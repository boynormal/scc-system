import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getPersonnelOrgView } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "hr_personnel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId) throw new ValidationError("กรุณาเลือกสาขา")
  const isActiveRaw = searchParams.get("isActive")
  const isActive = isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : isActiveRaw === "all" ? null : true

  const result = await getPersonnelOrgView(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    search: searchParams.get("search"),
    isActive,
  })
  return Response.json(result)
})
