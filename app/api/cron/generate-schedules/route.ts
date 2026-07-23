import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/shared/db"
import { generateMaintenanceSchedules } from "@/modules/maintenance"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await generateMaintenanceSchedules(prisma)
  return NextResponse.json(result)
}
