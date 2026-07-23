import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { getJobById, updateJob, updateJobSchema, deleteJob } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await getJobById(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateJobSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await updateJob(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data })
})

export const DELETE = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await deleteJob(prisma, {
    id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
