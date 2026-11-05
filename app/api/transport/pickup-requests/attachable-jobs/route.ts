import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { listAttachableJobs } from "@/modules/transport"

export const GET = withAuth(async (_req, _ctx, session) => {
  const data = await listAttachableJobs(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
  })
  return Response.json({ data })
})
