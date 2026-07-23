import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deleteMachineProduct, updateMachineProduct, updateMachineProductSchema } from "@/modules/machines"

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string; productId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateMachineProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await updateMachineProduct(prisma, {
    machineId: params.id,
    productId: params.productId,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; productId: string }> }
) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deleteMachineProduct(prisma, {
    machineId: params.id,
    productId: params.productId,
    companyId: session.user.companyId as string,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
