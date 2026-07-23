import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { deleteMachineSparePart, updateMachineSparePart, updateMachineSparePartSchema } from "@/modules/machines"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; lineId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateMachineSparePartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await updateMachineSparePart(prisma, {
    machineId: params.id,
    lineId: params.lineId,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; lineId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteMachineSparePart(prisma, {
    machineId: params.id,
    lineId: params.lineId,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
