import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { listPickupRequests, type PickupRequestView } from "@/modules/transport"

const VIEWS: PickupRequestView[] = ["queue", "scheduled", "all"]

export const GET = withAuth(async (req, _ctx, session) => {
  const raw = new URL(req.url).searchParams.get("view")
  const view = VIEWS.includes(raw as PickupRequestView) ? (raw as PickupRequestView) : "queue"
  const data = await listPickupRequests(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    view,
  })
  return Response.json({ data })
})
