import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { markRepairInspection } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await markRepairInspection(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
