import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { deactivateSparePart, getSparePartById, updateSparePart, updateSparePartSchema } from "@/modules/inventory"

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await getSparePartById(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = updateSparePartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await updateSparePart(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await deactivateSparePart(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(result)
}
