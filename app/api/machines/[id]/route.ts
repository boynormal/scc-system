import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deleteMachine, getMachineById, updateMachine, updateMachineSchema } from "@/modules/machines"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const machine = await getMachineById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!machine) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ data: machine })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateMachineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await updateMachine(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteMachine(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(result)
}
