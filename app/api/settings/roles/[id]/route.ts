import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { NotFoundError, ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getBranchIds, hasPermission, isAdminInAnyBranch } from "@/lib/permissions"
import { getRoleById, updateRole, updateRoleSchema, deleteRole } from "@/modules/settings"

type Ctx = { params: Promise<{ id: string }> }

function assertRolePerm(roles: UserRole[], action: "read" | "update" | "delete") {
  const ok =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "roles", action))
  if (!ok) throw new ForbiddenError("Forbidden")
}

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  assertRolePerm(session.user.roles as UserRole[], "read")
  const { id } = await ctx.params
  const role = await getRoleById(prisma, { id, companyId: session.user.companyId as string })
  if (!role) throw new NotFoundError("Role not found")
  return Response.json({ data: role })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
  assertRolePerm(session.user.roles as UserRole[], "update")
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await updateRole(prisma, {
    id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  return Response.json({ data })
})

export const DELETE = withAuth<Ctx>(async (_req, ctx, session) => {
  assertRolePerm(session.user.roles as UserRole[], "delete")
  const { id } = await ctx.params
  const result = await deleteRole(prisma, { id, companyId: session.user.companyId as string })
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ success: true })
})
