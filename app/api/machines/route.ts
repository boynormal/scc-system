import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { type UserRole } from "@/lib/permissions"
import { createMachine, createMachineSchema, listMachines } from "@/modules/machines"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20")

  const result = await listMachines(prisma, {
    companyId,
    roles,
    branchId: searchParams.get("branchId"),
    categoryId: searchParams.get("categoryId"),
    status: searchParams.get("status"),
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
  const parsed = createMachineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const roles = session.user.roles as UserRole[]
  const result = await createMachine(prisma, {
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles,
    input: parsed.data,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result, { status: 201 })
}
