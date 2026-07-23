import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { listAttendanceEntries } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

  const result = await listAttendanceEntries(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    branchId,
    from,
    to,
    page,
    pageSize,
  })
  return Response.json(result)
})
