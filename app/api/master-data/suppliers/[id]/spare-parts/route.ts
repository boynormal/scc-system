import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { getSupplierSpareParts } from "@/modules/settings"

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await getSupplierSpareParts(prisma, {
    id: params.id,
    companyId: session.user.companyId as string,
  })
  if (!result) return NextResponse.json({ error: { message: "Supplier not found" } }, { status: 404 })

  return NextResponse.json(result)
}
