import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { addTechnician, addTechnicianSchema, listTechnicians } from "@/modules/work_orders"

function zodMessage(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] } }) {
  const flat = error.flatten()
  return Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "ข้อมูลไม่ถูกต้อง"
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "work_orders", "read")
  if (denied) return denied

  const result = await listTechnicians(prisma, {
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

  const body = await req.json().catch(() => null)
  const parsed = addTechnicianSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  const result = await addTechnician(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    roles,
    userId: parsed.data.userId,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ data: result.data })
}
