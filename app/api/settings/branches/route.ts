import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createBranch, createBranchSchema, listSettingsBranches } from "@/modules/settings"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await listSettingsBranches(prisma, session.user.companyId as string)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createBranchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await createBranch(prisma, {
    companyId: session.user.companyId as string,
    input: parsed.data,
  })
  return NextResponse.json({ data }, { status: 201 })
}
