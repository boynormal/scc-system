import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { NotFoundError } from "@/lib/errors"
import { getRoleById, updateRole, updateRoleSchema, deleteRole } from "@/modules/settings"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const role = await getRoleById(prisma, { id, companyId: session.user.companyId as string })
  if (!role) throw new NotFoundError("Role not found")
  return Response.json({ data: role })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
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
  const { id } = await ctx.params
  const result = await deleteRole(prisma, { id, companyId: session.user.companyId as string })
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ success: true })
})
