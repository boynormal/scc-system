import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { removeTechnician } from "@/modules/work_orders"

export async function DELETE(_req: Request, props: { params: Promise<{ id: string; userId: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "work_orders", "update")
  if (denied) return denied

  const result = await removeTechnician(prisma, {
    id: params.id,
    userId: params.userId,
    companyId: session.user.companyId as string,
    roles,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ data: result.data })
}
