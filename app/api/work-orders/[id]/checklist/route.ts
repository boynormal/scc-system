import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getChecklistView, recordChecklistResult, recordChecklistSchema } from "@/modules/work_orders"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "work_orders", "read")
  if (denied) return denied

  const result = await getChecklistView(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    roles,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ data: result.data })
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "work_orders", "update")
  if (denied) return denied

  const parsed = recordChecklistSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 })

  const result = await recordChecklistResult(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles,
    input: parsed.data,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ data: result.data })
}
