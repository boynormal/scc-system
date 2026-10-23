import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { deleteWorkOrder, getWorkOrderDetail, updateWorkOrder, updateWorkOrderSchema } from "@/modules/work_orders"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const wo = await getWorkOrderDetail(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if ("error" in wo) return NextResponse.json({ error: wo.error }, { status: wo.status })
  return NextResponse.json({
    data: wo,
  })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateWorkOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await updateWorkOrder(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if ("error" in updated) return NextResponse.json({ error: updated.error }, { status: updated.status })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteWorkOrder(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
