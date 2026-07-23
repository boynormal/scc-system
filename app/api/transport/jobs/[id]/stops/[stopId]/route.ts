import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { updateStop, updateStopSchema } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string; stopId: string }> }

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
  const { id, stopId } = await ctx.params
  const body = await req.json()
  const parsed = updateStopSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await updateStop(prisma, {
    jobId: id,
    stopId,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data })
})
