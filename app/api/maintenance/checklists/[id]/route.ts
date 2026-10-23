import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { updateChecklistTemplate, updateChecklistTemplateSchema } from "@/modules/maintenance"

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "settings", "update")
  if (denied) return denied

  const parsed = updateChecklistTemplateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid data", details: parsed.error.flatten() } }, { status: 400 })
  }
  const result = await updateChecklistTemplate(prisma, {
    id,
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    input: parsed.data,
  })
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
