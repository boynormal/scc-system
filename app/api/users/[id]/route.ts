import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deactivateUser, getUserById, updateUser, updateUserSchema } from "@/modules/iam"
import { hasPermission, type UserRole } from "@/lib/permissions"
import type { ZodError } from "zod"

function zodErrorResponse(error: ZodError) {
  const flat = error.flatten()
  const message = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "ข้อมูลไม่ถูกต้อง"
  return NextResponse.json({ error: { message, fieldErrors: flat.fieldErrors } }, { status: 400 })
}

function toErrorBody(error: { message: string } | string | undefined) {
  if (!error) return { message: "เกิดข้อผิดพลาด กรุณาลองใหม่" }
  return typeof error === "string" ? { message: error } : error
}

/** user ที่ยังไม่ผูกสาขา/role ใด ๆ ให้แก้ไขได้เฉพาะ Admin ของบริษัท */
function canManageUserBranches(roles: UserRole[], branchIds: string[], action: "read" | "update" | "delete") {
  if (branchIds.length === 0) return roles.some((r) => r.roleName === "Admin")
  const check = (bid: string) => hasPermission(roles, bid, "users", action)
  return action === "read" ? branchIds.some(check) : branchIds.every(check)
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 })

  const data = await getUserById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 })

  const roles = session.user.roles as UserRole[]
  const branchIds = data.userBranchRoles.map((r) => r.branch.id)
  if (!canManageUserBranches(roles, branchIds, "read")) {
    return NextResponse.json({ error: { message: "ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้งาน" } }, { status: 403 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 })

  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return zodErrorResponse(parsed.error)

  const existing = await getUserById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!existing) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 })

  const roles = session.user.roles as UserRole[]
  const branchIds = new Set(existing.userBranchRoles.map((r) => r.branch.id))
  if (parsed.data.branchId) branchIds.add(parsed.data.branchId)
  if (!canManageUserBranches(roles, Array.from(branchIds), "update")) {
    return NextResponse.json({ error: { message: "ไม่มีสิทธิ์แก้ไขผู้ใช้งานนี้" } }, { status: 403 })
  }

  try {
    const result = await updateUser(prisma, {
      id: params.id,
      companyId: session.user.companyId as string,
      assignedBy: session.user.id as string,
      input: parsed.data,
    })
    if ("error" in result) {
      return NextResponse.json({ error: toErrorBody(result.error) }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error("[PATCH /api/users/:id]", e)
    return NextResponse.json({ error: { message: "เกิดข้อผิดพลาด กรุณาลองใหม่" } }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 })

  const existing = await getUserById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!existing) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 })

  const roles = session.user.roles as UserRole[]
  const branchIds = existing.userBranchRoles.map((r) => r.branch.id)
  if (!canManageUserBranches(roles, branchIds, "delete")) {
    return NextResponse.json({ error: { message: "ไม่มีสิทธิ์ลบผู้ใช้งานนี้" } }, { status: 403 })
  }

  try {
    const result = await deactivateUser(prisma, {
      id: params.id,
      companyId: session.user.companyId as string,
      currentUserId: session.user.id as string,
    })
    if ("error" in result) {
      return NextResponse.json({ error: toErrorBody(result.error) }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error("[DELETE /api/users/:id]", e)
    return NextResponse.json({ error: { message: "เกิดข้อผิดพลาด กรุณาลองใหม่" } }, { status: 500 })
  }
}
