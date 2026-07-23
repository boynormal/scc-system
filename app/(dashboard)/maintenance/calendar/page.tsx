import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "ปฏิทินซ่อมบำรุง" }

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  skipped: "bg-slate-100 text-slate-400 border-slate-200",
}

async function getCalendarSchedules(companyId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return prisma.maintenanceSchedule.findMany({
    where: {
      machine: { branch: { companyId } },
      dueDate: { gte: start, lte: end },
    },
    include: {
      plan: { include: { type: { select: { code: true, color: true } } } },
      machine: { select: { id: true, name: true, code: true } },
    },
    orderBy: { dueDate: "asc" },
  })
}

export default async function MaintenanceCalendarPage(
  props: {
    searchParams: Promise<{ year?: string; month?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const companyId = session!.user.companyId as string

  const now = new Date()
  const year = parseInt(searchParams.year ?? String(now.getFullYear()))
  const month = parseInt(searchParams.month ?? String(now.getMonth() + 1))

  const schedules = await getCalendarSchedules(companyId, year, month)

  const schedulesByDay: Record<number, typeof schedules> = {}
  schedules.forEach(s => {
    const day = new Date(s.dueDate).getDate()
    if (!schedulesByDay[day]) schedulesByDay[day] = []
    schedulesByDay[day].push(s)
  })

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const prevMonth = month === 1 ? `?year=${year - 1}&month=12` : `?year=${year}&month=${month - 1}`
  const nextMonth = month === 12 ? `?year=${year + 1}&month=1` : `?year=${year}&month=${month + 1}`
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (day: number) =>
    now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ปฏิทินซ่อมบำรุง</h1>
          <p className="text-slate-500 text-sm mt-1">{schedules.length} กำหนดการในเดือนนี้</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <Link href={`/maintenance/calendar${prevMonth}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h2 className="text-lg font-bold text-slate-800">{monthName}</h2>
          <Link href={`/maintenance/calendar${nextMonth}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </Link>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d, i) => (
            <div key={d} className={`py-2.5 text-center text-xs font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                !day ? "bg-slate-50" : ""
              } ${idx % 7 === 6 ? "border-r-0" : ""}`}
            >
              {day && (
                <>
                  <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full mb-1 ${
                    isToday(day)
                      ? "bg-blue-600 text-white"
                      : idx % 7 === 0 ? "text-red-500" : idx % 7 === 6 ? "text-blue-500" : "text-slate-700"
                  }`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {(schedulesByDay[day] ?? []).slice(0, 3).map(s => (
                      <Link
                        key={s.id}
                        href={`/maintenance/plans/${s.plan.id}`}
                        title={`${s.machine.name} — ${s.plan.name}`}
                        className={`block px-1.5 py-0.5 rounded text-[10px] font-medium border truncate hover:opacity-80 transition-opacity ${statusColor[s.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
                      >
                        {s.machine.code}: {s.plan.type.code}
                      </Link>
                    ))}
                    {(schedulesByDay[day]?.length ?? 0) > 3 && (
                      <p className="text-[10px] text-slate-400 px-1">+{schedulesByDay[day].length - 3} อื่นๆ</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 flex-wrap">
          {[
            { label: "รอดำเนินการ", cls: "bg-amber-100 text-amber-800 border-amber-200" },
            { label: "กำลังดำเนินการ", cls: "bg-blue-100 text-blue-800 border-blue-200" },
            { label: "เสร็จสิ้น", cls: "bg-green-100 text-green-800 border-green-200" },
            { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500 border-slate-200" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded border ${l.cls}`} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
