import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getPaperMarketSnapshot } from "@/modules/raw_material_news"

export const maxDuration = 60

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(
    session.user.roles as UserRole[],
    "raw_material_news",
    "read"
  )
  if (denied) return denied

  const data = await getPaperMarketSnapshot()
  return Response.json(data)
})
