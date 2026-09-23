import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { getJobPunchView, recordJobPunch, skipJobStop } from "@/modules/transport"
import type { UserRole } from "@/lib/permissions"
import { z } from "zod"

type Ctx = { params: Promise<{ id: string }> }

const position = {
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
}

const punchSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["start", "finish"]),
    ...position,
  }),
  z.object({
    kind: z.enum(["arrive", "depart"]),
    stopId: z.string().uuid(),
    ...position,
  }),
])

const skipSchema = z.object({
  stopId: z.string().uuid(),
  action: z.literal("skip"),
})

export const GET = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await getJobPunchView(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as UserRole[],
  })
  return Response.json({ data })
})

export const POST = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const skip = skipSchema.safeParse(body)
  if (skip.success) {
    const data = await skipJobStop(prisma, {
      id,
      companyId: session.user.companyId as string,
      userId: session.user.id as string,
      roles: session.user.roles as UserRole[],
      stopId: skip.data.stopId,
    })
    return Response.json({ data })
  }

  const parsed = punchSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลบันทึกไม่ถูกต้อง")
  const data = await recordJobPunch(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as UserRole[],
    stopId: parsed.data.kind === "arrive" || parsed.data.kind === "depart" ? parsed.data.stopId : null,
    kind: parsed.data.kind,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  })
  return Response.json({ data })
})
