import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createMaintenancePlan, createMaintenancePlanSchema, listMaintenancePlans } from "@/modules/maintenance"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "maintenance_plans", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const data = await listMaintenancePlans(prisma, {
    companyId: session.user.companyId as string,
    roles,
    machineId: searchParams.get("machineId"),
    assetId: searchParams.get("assetId"),
    isActive: searchParams.get("isActive"),
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "maintenance_plans", "create")
  if (denied) return denied

  const body = await req.json()
  const parsed = createMaintenancePlanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const plan = await createMaintenancePlan(prisma, {
    userId: session.user.id as string,
    companyId: session.user.companyId as string,
    roles,
    input: parsed.data,
  })
  if ("error" in plan) return NextResponse.json({ error: plan.error }, { status: plan.status })

  return NextResponse.json({ data: plan }, { status: 201 })
}
