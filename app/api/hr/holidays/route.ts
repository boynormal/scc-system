import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { createAttendanceHoliday, holidayInputSchema, listAttendanceHolidays } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const year = Number(new URL(req.url).searchParams.get("year"))
  const data = await listAttendanceHolidays(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    year,
  })
  return Response.json({ data })
})

export const POST = withAuth(async (req, _ctx, session) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }
  const parsed = holidayInputSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง")
  const data = await createAttendanceHoliday(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  return Response.json({ data })
})
