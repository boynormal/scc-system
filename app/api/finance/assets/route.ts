import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"

/** Active assets for the expense line picker. Uses the expense permission, not the asset register. */
export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied
  const rows = await prisma.asset.findMany({
    where: {
      companyId: session.user.companyId as string,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
    orderBy: [{ code: "asc" }],
  })
  return Response.json({ data: rows })
})
