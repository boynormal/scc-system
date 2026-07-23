import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { listRoles } from "@/modules/settings"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await listRoles(prisma, session.user.companyId as string)
  return NextResponse.json({ data })
}
