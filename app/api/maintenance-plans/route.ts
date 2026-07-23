import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createMaintenancePlan, createMaintenancePlanSchema, listMaintenancePlans } from "@/modules/maintenance"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const data = await listMaintenancePlans(prisma, {
    companyId: session.user.companyId as string,
    machineId: searchParams.get("machineId"),
    isActive: searchParams.get("isActive"),
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createMaintenancePlanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const plan = await createMaintenancePlan(prisma, {
    userId: session.user.id as string,
    input: parsed.data,
  })

  return NextResponse.json({ data: plan }, { status: 201 })
}
