import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { listCalendarJobs } from "@/modules/transport/application/calendar-service"

/** @deprecated import type จาก `@/modules/transport/application/calendar-service` แทน — เก็บ re-export ไว้ให้ import เดิมยังใช้ได้ */
export type { CalendarJob } from "@/modules/transport/application/calendar-service"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const vehicleId = searchParams.get("vehicleId") ?? undefined

  const data = await listCalendarJobs(prisma, {
    companyId: session.user.companyId as string,
    from,
    to,
    vehicleId,
  })
  return Response.json({ data })
})
