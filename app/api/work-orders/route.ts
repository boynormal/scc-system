import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { type UserRole } from "@/lib/permissions"
import { notifyWOAssigned } from "@/lib/notifications"
import { createWorkOrder, createWorkOrderSchema, listWorkOrders } from "@/modules/work_orders"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20")

  const result = await listWorkOrders(prisma, {
    companyId,
    roles,
    branchId: searchParams.get("branchId"),
    status: searchParams.get("status"),
    priority: searchParams.get("priority"),
    assignedTo: searchParams.get("assignedTo"),
    search: searchParams.get("search"),
    page,
    pageSize,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createWorkOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const roles = session.user.roles as UserRole[]
  const result = await createWorkOrder(prisma, {
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles,
    input: parsed.data,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (parsed.data.assignedTo && parsed.data.assignedTo !== session.user.id) {
    await notifyWOAssigned(result.data.id, parsed.data.assignedTo, parsed.data.title, result.woNumber).catch(() => {})
  }

  return NextResponse.json({ data: result.data }, { status: 201 })
}
