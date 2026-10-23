import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { addManualLaborEntry, applyLaborAction, getLaborView, laborPostSchema } from "@/modules/work_orders"

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

  const result = await getLaborView(prisma, {
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
  const parsed = laborPostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })

  const common = {
    id: params.id,
    companyId: session.user.companyId as string,
    actorId: session.user.id as string,
    roles,
  }
  const result =
    parsed.data.mode === "action"
      ? await applyLaborAction(prisma, { ...common, input: parsed.data })
      : await addManualLaborEntry(prisma, { ...common, input: parsed.data })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ data: result.data })
}
