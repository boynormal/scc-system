import type { Prisma } from "@prisma/client"
import { dateKeyToDbDate, summarizePunchesByDay, zonedDayRange } from "./attendance-daily-summary"

type Tx = Prisma.TransactionClient

/**
 * สร้าง attendance_days ใหม่ทุกคู่ (personnelId × วันที่) จาก keys ในสาขาเดียว
 * คู่ที่ไม่มี punch เหลือแล้วจะถูกลบ
 */
export async function rebuildAttendanceDays(
  tx: Tx,
  params: {
    companyId: string
    branchId: string
    timeZone: string
    keys: Array<{ personnelId: string; dateKey: string }>
  }
): Promise<{ written: number; removed: number }> {
  if (params.keys.length === 0) return { written: 0, removed: 0 }

  const personnelIds = [...new Set(params.keys.map((k) => k.personnelId))]
  const dateKeys = [...new Set(params.keys.map((k) => k.dateKey))].sort()
  const dateKeySet = new Set(dateKeys)

  const from = zonedDayRange(dateKeys[0]!, params.timeZone).start
  const to = zonedDayRange(dateKeys[dateKeys.length - 1]!, params.timeZone).end

  const punches = await tx.attendancePunch.findMany({
    where: {
      branchId: params.branchId,
      personnelId: { in: personnelIds },
      punchAt: { gte: from, lt: to },
    },
    select: { personnelId: true, punchAt: true },
  })

  const summaries = summarizePunchesByDay(
    punches.filter((p): p is { personnelId: string; punchAt: Date } => p.personnelId != null),
    params.timeZone
  )

  const removed = await tx.attendanceDay.deleteMany({
    where: {
      branchId: params.branchId,
      personnelId: { in: personnelIds },
      workDate: { in: dateKeys.map(dateKeyToDbDate) },
    },
  })

  const rows: Prisma.AttendanceDayCreateManyInput[] = []
  for (const s of summaries.values()) {
    if (!dateKeySet.has(s.dateKey)) continue
    rows.push({
      companyId: params.companyId,
      branchId: params.branchId,
      personnelId: s.personnelId,
      workDate: dateKeyToDbDate(s.dateKey),
      firstIn: s.summary.firstIn,
      lastOut: s.summary.lastOut,
      punchCount: s.summary.punchCount,
      workedMinutes: s.summary.workedMinutes,
      status: s.summary.status,
    })
  }
  if (rows.length > 0) await tx.attendanceDay.createMany({ data: rows })

  return { written: rows.length, removed: Math.max(0, removed.count - rows.length) }
}
