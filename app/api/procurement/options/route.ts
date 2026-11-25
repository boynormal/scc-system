import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getPurchaseOrderOptions } from "@/modules/procurement"

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "purchase_orders", "read")
  if (denied) return denied
  const result = await getPurchaseOrderOptions(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
  })
  return Response.json(result)
})
