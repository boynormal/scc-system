import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createRole, createRoleSchema, listSettingsRoles } from "@/modules/settings"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "roles", "read")
  if (denied) return denied

  const data = await listSettingsRoles(prisma, session.user.companyId as string)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "roles", "create")
  if (denied) return denied

  const body = await req.json()
  const parsed = createRoleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await createRole(prisma, {
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  return NextResponse.json({ data }, { status: 201 })
}
