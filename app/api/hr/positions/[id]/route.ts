import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import {
  canReadPositions,
  deletePosition,
  getPosition,
  updatePosition,
  updatePositionSchema,
} from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  if (!canReadPositions(roles)) throw new ForbiddenError()
  const { id } = await ctx.params

  const result = await getPosition(prisma, {
    companyId: session.user.companyId as string,
    roles,
    id,
  })
  return Response.json(result)
})

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "hr_positions", "update")
  if (denied) return denied
  const { id } = await ctx.params

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const parsed = updatePositionSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลตำแหน่งไม่ถูกต้อง")

  const result = await updatePosition(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    id,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})

export const DELETE = withAuth<Ctx>(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "hr_positions", "delete")
  if (denied) return denied
  const { id } = await ctx.params

  const result = await deletePosition(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    id,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
