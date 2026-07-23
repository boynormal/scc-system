import { NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { generateCompanyNotifications } from "@/modules/notifications"

export async function GET() {
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
