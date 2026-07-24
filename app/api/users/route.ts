import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createUser, createUserSchema, listUsers } from "@/modules/iam"
import { hasPermission, type UserRole } from "@/lib/permissions"
import type { ZodError } from "zod"

function zodErrorResponse(error: ZodError) {
  const flat = error.flatten()
  const message = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "ข้อมูลไม่ถูกต้อง"
  return NextResponse.json({ error: { message, fieldErrors: flat.fieldErrors } }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 })

  const roles = session.user.roles as UserRole[]
  const canRead = roles.some((r) => hasPermission(roles, r.branchId, "users", "read"))
  if (!canRead) {
    return NextResponse.json({ error: { message: "ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้งาน" } }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20")

  const result = await listUsers(prisma, {
    companyId: session.user.companyId as string,
    search: searchParams.get("search"),
    page,
    pageSize,
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 })

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return zodErrorResponse(parsed.error)

  const roles = session.user.roles as UserRole[]
  if (!hasPermission(roles, parsed.data.branchId, "users", "create")) {
    return NextResponse.json({ error: { message: "ไม่มีสิทธิ์สร้างผู้ใช้งานในสาขานี้" } }, { status: 403 })
  }

  try {
    const result = await createUser(prisma, {
      companyId: session.user.companyId as string,
      input: parsed.data,
    })
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error("[POST /api/users]", e)
    return NextResponse.json({ error: { message: "เกิดข้อผิดพลาด กรุณาลองใหม่" } }, { status: 500 })
  }
}
