import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { deleteAttendanceHoliday, holidayInputSchema, updateAttendanceHoliday } from "@/modules/hr"

export const PATCH = withAuth(async (req, ctx, session) => {
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }
  const parsed = holidayInputSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง")
  const data = await updateAttendanceHoliday(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
    input: parsed.data,
  })
  return Response.json({ data })
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const { id } = await ctx.params
  await deleteAttendanceHoliday(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json({ ok: true })
})
