import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { generateCompanyNotifications } from "@/modules/notifications"
import { generateAllDueItemNotifications } from "@/modules/due_dates"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [generated, dueDates] = await Promise.all([
      generateCompanyNotifications(prisma),
      generateAllDueItemNotifications(prisma),
    ])

    return NextResponse.json({
      success: true,
      generated,
      dueDates,
    })
  } catch (error) {
    console.error("Cron notify error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
