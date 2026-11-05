import { z } from "zod"
import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { attachPickupRequestToJob } from "@/modules/transport"

const bodySchema = z.object({ jobId: z.string().uuid() })

export const POST = withAuth(async (req, ctx, session) => {
  const { id } = await ctx.params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new ValidationError("เลือกใบงาน")
  const data = await attachPickupRequestToJob(prisma, {
    requestId: id,
    jobId: parsed.data.jobId,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
