import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { issueCustomerPickupToken } from "@/modules/transport"

export const POST = withAuth(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await issueCustomerPickupToken(prisma, {
    customerId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
