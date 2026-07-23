import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { completeJob } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await completeJob(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
