import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { getAssignment, assignJob, unassignJob, assignJobSchema } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await getAssignment(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = assignJobSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await assignJob(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})

export const DELETE = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await unassignJob(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
