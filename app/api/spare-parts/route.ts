import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createSparePart, createSparePartSchema, listSpareParts } from "@/modules/inventory"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20")

  const result = await listSpareParts(prisma, {
    companyId: session.user.companyId as string,
    search: searchParams.get("search"),
    branchId: searchParams.get("branchId"),
    lowStock: searchParams.get("lowStock") === "true",
    page,
    pageSize,
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSparePartSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await createSparePart(prisma, {
    companyId: session.user.companyId as string,
    input: parsed.data,
  })

  return NextResponse.json({ data }, { status: 201 })
}
