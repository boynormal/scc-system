import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { listUserNotifications } from "@/modules/notifications"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unreadOnly") === "true"
  const limit = parseInt(searchParams.get("limit") ?? "20")

  const result = await listUserNotifications(prisma, {
    userId: session.user.id as string,
    unreadOnly,
    limit,
  })

  return NextResponse.json(result)
}
