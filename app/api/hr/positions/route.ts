import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import {
  canReadPositions,
  createPosition,
  createPositionSchema,
  listPositions,
} from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  // อ่านได้ถ้าอ่านตำแหน่งหรืออ่านบุคลากรได้ — ฟอร์มบุคลากรและผังองค์กรต้องใช้ตัวเลือกนี้
  if (!canReadPositions(roles)) throw new ForbiddenError()

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId) throw new ValidationError("กรุณาเลือกสาขา")

  const result = await listPositions(prisma, {
    companyId: session.user.companyId as string,
    roles,
    branchId,
    includeInactive: searchParams.get("includeInactive") === "true",
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "hr_positions", "create")
  if (denied) return denied

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const parsed = createPositionSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลตำแหน่งไม่ถูกต้อง")

  const result = await createPosition(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result, { status: 201 })
})
