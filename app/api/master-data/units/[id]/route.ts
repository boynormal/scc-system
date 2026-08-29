import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { deleteUnit, updateUnit, updateUnitSchema } from "@/modules/settings"
import { AppError } from "@/lib/errors"

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "settings", "update")
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { message: "Invalid body" } }, { status: 400 })
  }
  const parsed = updateUnitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { message: "ข้อมูลไม่ถูกต้อง" } }, { status: 400 })

  try {
    const data = await updateUnit(prisma, {
      id: params.id,
      companyId: session.user.companyId as string,
      input: parsed.data,
    })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: { message: e.message } }, { status: e.status })
    }
    throw e
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "settings", "delete")
  if (denied) return denied

  const result = await deleteUnit(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
