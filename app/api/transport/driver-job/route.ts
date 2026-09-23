import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api-handler"
import { prisma } from "@/shared/db"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { DRIVER_JOB_COOKIE } from "@/lib/driver-session"

const bodySchema = z.object({
  jobId: z.string().uuid(),
})

export const POST = withAuth(async (req, _ctx, session) => {
  if (!session.user.driverLogin) throw new ForbiddenError()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new ValidationError("รหัสใบงานไม่ถูกต้อง")

  const job = await prisma.transportJob.findFirst({
    where: { id: parsed.data.jobId, companyId: session.user.companyId },
    select: { id: true },
  })
  if (!job) throw new ForbiddenError()

  const jar = await cookies()
  jar.set(DRIVER_JOB_COOKIE, parsed.data.jobId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  })
  return Response.json({ ok: true })
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get("clear") !== "1") {
    return new Response(null, { status: 404 })
  }
  const jar = await cookies()
  jar.delete(DRIVER_JOB_COOKIE)
  return NextResponse.redirect(new URL("/transport/drive", req.url))
}
