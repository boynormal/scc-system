import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import {
  createMaintenanceSchedule,
  createMaintenanceScheduleSchema,
  listMaintenanceSchedules,
} from "@/modules/maintenance"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "schedules", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50")

  const result = await listMaintenanceSchedules(prisma, {
    companyId: session.user.companyId as string,
    roles,
    branchId: searchParams.get("branchId"),
    status: searchParams.get("status"),
    machineId: searchParams.get("machineId"),
    assetId: searchParams.get("assetId"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    page,
    pageSize,
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "schedules", "create")
  if (denied) return denied

  const body = await req.json()
  const parsed = createMaintenanceScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createMaintenanceSchedule(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result, { status: 201 })
}
