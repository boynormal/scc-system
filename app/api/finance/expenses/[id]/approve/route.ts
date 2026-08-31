import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { approveExpense } from "@/modules/finance"

export const POST = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "approve")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await approveExpense(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
