import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { closeRepair } from "@/modules/transport"
import { z } from "zod"

type Ctx = { params: Promise<{ id: string }> }

const closeBodySchema = z.object({
  repairCost: z.number().min(0).nullable().optional(),
})

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  let repairCost: number | null | undefined

  const text = await req.text()
  if (text.trim()) {
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new ValidationError("Invalid JSON body")
    }
    const parsed = closeBodySchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))
    repairCost = parsed.data.repairCost
  }

  const data = await closeRepair(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
    repairCost,
  })
  return Response.json({ data })
})
