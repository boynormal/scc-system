import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getBranchIds, hasPermission } from "@/lib/permissions"
import {
  getBranchSharing,
  updateBranchSharing,
  updateBranchSharingSchema,
} from "@/modules/settings"

function canUpdateSettings(roles: UserRole[]) {
  return getBranchIds(roles).some((branchId) => hasPermission(roles, branchId, "settings", "update"))
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const roles = session.user.roles as UserRole[]
  if (!canUpdateSettings(roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const data = await getBranchSharing(prisma, session.user.companyId as string)
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateBranchSharingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateBranchSharing(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
