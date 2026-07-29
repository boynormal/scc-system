import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { NotFoundError, ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getBranchIds, hasPermission, isAdminInAnyBranch } from "@/lib/permissions"
import { getBranchById, updateBranch, updateBranchSchema } from "@/modules/settings"

type Ctx = { params: Promise<{ id: string }> }

function assertBranchPerm(roles: UserRole[], action: "read" | "update") {
  const ok =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "branches", action))
  if (!ok) throw new ForbiddenError("Forbidden")
}

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  assertBranchPerm(session.user.roles as UserRole[], "read")
  const { id } = await ctx.params
  const branch = await getBranchById(prisma, { id, companyId: session.user.companyId as string })
  if (!branch) throw new NotFoundError("Branch not found")
  return Response.json({ data: branch })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
  assertBranchPerm(session.user.roles as UserRole[], "update")
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateBranchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await updateBranch(prisma, {
    id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  return Response.json({ data })
})
