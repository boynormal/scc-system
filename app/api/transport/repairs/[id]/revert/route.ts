import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { revertRepair, revertRepairSchema } from "@/modules/transport"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = revertRepairSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await revertRepair(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
    to: parsed.data.to,
  })
  return Response.json({ data })
})
