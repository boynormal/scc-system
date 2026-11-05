import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { cancelPickupRequest, getPickupRequest } from "@/modules/transport"

export const GET = withAuth(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await getPickupRequest(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { action?: string } | null
  if (body?.action !== "cancel") throw new ValidationError("action must be cancel")
  const data = await cancelPickupRequest(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
