import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { generateCompanyNotifications } from "@/modules/notifications"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const generated = await generateCompanyNotifications(prisma)

    return NextResponse.json({
      success: true,
      generated,
    })
  } catch (error) {
    console.error("Cron notify error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
