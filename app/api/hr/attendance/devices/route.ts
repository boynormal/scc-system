import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { createAttendanceDevice, createAttendanceDeviceSchema, listAttendanceDevices } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const data = await listAttendanceDevices(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
  })
  return Response.json({ data })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createAttendanceDeviceSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "ข้อมูลเครื่องสแกนไม่ถูกต้อง")
  const data = await createAttendanceDevice(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
