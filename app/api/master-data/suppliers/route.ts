import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createSupplier, listSuppliers } from "@/modules/settings"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await listSuppliers(prisma, {
    companyId: session.user.companyId as string,
    includeInactive: req.nextUrl.searchParams.get("includeInactive") === "1",
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const result = await createSupplier(prisma, {
    companyId: session.user.companyId as string,
    input: body,
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result, { status: 201 })
}
