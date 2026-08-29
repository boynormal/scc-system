import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createUnit, createUnitSchema, listUnits } from "@/modules/settings"
import { AppError } from "@/lib/errors"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const data = await listUnits(prisma, {
    companyId: session.user.companyId as string,
    includeInactive: searchParams.get("includeInactive") === "1",
  })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
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
  const parsed = createUnitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { message: "ข้อมูลไม่ถูกต้อง" } }, { status: 400 })

  try {
    const data = await createUnit(prisma, {
      companyId: session.user.companyId as string,
      input: parsed.data,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: { message: e.message } }, { status: e.status })
    }
    throw e
  }
}
