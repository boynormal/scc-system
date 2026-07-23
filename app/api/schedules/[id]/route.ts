import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deleteMaintenanceSchedule } from "@/modules/maintenance"

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteMaintenanceSchedule(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    ipAddress: _req.headers.get("x-forwarded-for"),
    userAgent: _req.headers.get("user-agent"),
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
