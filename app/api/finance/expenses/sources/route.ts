import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listUnlinkedExpenseSources } from "@/modules/finance"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await listUnlinkedExpenseSources(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
  })
  return Response.json(result)
})
