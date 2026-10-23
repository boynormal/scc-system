import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { generateMaintenanceSchedulesForUser } from "@/modules/maintenance"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "schedules", "create")
  if (denied) return denied

  const result = await generateMaintenanceSchedulesForUser(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
