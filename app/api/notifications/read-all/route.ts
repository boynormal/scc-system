import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { auth } from "@/lib/auth"
import { markAllNotificationsRead } from "@/modules/notifications"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await markAllNotificationsRead(prisma, {
    userId: session.user.id as string,
  })

  return NextResponse.json(result)
}
