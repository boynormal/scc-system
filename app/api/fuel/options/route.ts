import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getFuelOptions } from "@/modules/fuel"

export const GET = withAuth(async (_req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "read")
  if (denied) return denied
  const result = await getFuelOptions(prisma, { companyId: session.user.companyId as string, roles })
  return Response.json(result)
})
