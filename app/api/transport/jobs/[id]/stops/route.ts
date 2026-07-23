import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { addStop, createStopSchema, listStops } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await listStops(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = createStopSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await addStop(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
