import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { createCategory, createCategorySchema, listCategories } from "@/modules/settings"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await listCategories(prisma, session.user.companyId as string)
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await createCategory(prisma, {
    companyId: session.user.companyId as string,
    input: parsed.data,
  })

  return NextResponse.json({ data }, { status: 201 })
}
