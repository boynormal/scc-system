import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { createAttachment, createAttachmentSchema, listAttachments } from "@/modules/transport"
import type { AttachmentStage } from "@prisma/client"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get("stage") as AttachmentStage | null

  const data = await listAttachments(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    stage,
  })
  return Response.json({ data })
})

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = createAttachmentSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await createAttachment(prisma, {
    jobId: id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
