import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { createMachineSparePart, createMachineSparePartSchema, listMachineSpareParts } from "@/modules/machines"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await listMachineSpareParts(prisma, {
    machineId: params.id,
    companyId: session.user.companyId as string,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createMachineSparePartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await createMachineSparePart(prisma, {
    machineId: params.id,
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result, { status: 201 })
}
