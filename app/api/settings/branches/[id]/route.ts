import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { NotFoundError } from "@/lib/errors"
import { getBranchById, updateBranch, updateBranchSchema } from "@/modules/settings"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const branch = await getBranchById(prisma, { id, companyId: session.user.companyId as string })
  if (!branch) throw new NotFoundError("Branch not found")
  return Response.json({ data: branch })
})

export const PUT = withAuth<Ctx>(async (req, ctx, session) => {
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
