import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { deleteAttendanceEntry } from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const DELETE = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params

  await deleteAttendanceEntry(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    id,
  })
  return Response.json({ ok: true })
})
