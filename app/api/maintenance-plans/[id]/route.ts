import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import {
  deactivateMaintenancePlan,
  getMaintenancePlanById,
  updateMaintenancePlan,
  updateMaintenancePlanSchema,
} from "@/modules/maintenance"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const plan = await getMaintenancePlanById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: plan })
}

async function updatePlan(req: NextRequest, params: { id: string }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateMaintenancePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid data", details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const updated = await updateMaintenancePlan(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ data: updated })
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return updatePlan(req, params)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return updatePlan(req, params)
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deactivateMaintenancePlan(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    ipAddress: _req.headers.get("x-forwarded-for"),
    userAgent: _req.headers.get("user-agent"),
  })
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(result)
}
