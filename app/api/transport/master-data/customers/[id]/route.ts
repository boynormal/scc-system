import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { deactivateTmsCustomer, updateTmsCustomer, updateTmsCustomerSchema } from "@/modules/transport"

export const PATCH = withAuth(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateTmsCustomerSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await updateTmsCustomer(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data })
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await deactivateTmsCustomer(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
