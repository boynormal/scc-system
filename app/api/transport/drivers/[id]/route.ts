import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { getDriverById, updateDriver, updateDriverSchema, deleteDriver } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await getDriverById(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateDriverSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await updateDriver(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data })
})

export const PATCH = PUT

export const DELETE = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  await deleteDriver(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ success: true })
})
