import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createMachineProduct, createMachineProductSchema, listMachineProducts } from "@/modules/machines"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await listMachineProducts(prisma, {
    machineId: params.id,
    companyId: session.user.companyId as string,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createMachineProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await createMachineProduct(prisma, {
    machineId: params.id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result, { status: 201 })
}
