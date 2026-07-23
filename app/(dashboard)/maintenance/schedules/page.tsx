import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { CalendarDays, AlertTriangle, Clock, CheckCircle2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { DeleteButton } from "@/components/ui/delete-button"

export const metadata: Metadata = { title: "ตารางงาน" }

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger"; icon: React.ElementType }> = {
  pending: { label: "รอดำเนินการ", variant: "warning", icon: Clock },
  in_progress: { label: "กำลังดำเนินการ", variant: "default", icon: RefreshCw },
  completed: { label: "เสร็จสิ้น", variant: "success", icon: CheckCircle2 },
  skipped: { label: "ข้าม", variant: "default", icon: Clock },
  cancelled: { label: "ยกเลิก", variant: "danger", icon: AlertTriangle },
}

async function getSchedules(companyId: string, status?: string, machineId?: string) {
  const now = new Date()
  return prisma.maintenanceSchedule.findMany({
    where: {
      machine: { branch: { companyId } },
      ...(status && { status: status as never }),
      ...(machineId && { machineId }),
    },
    include: {
      plan: { include: { type: { select: { code: true, color: true, name: true } } } },
      machine: { select: { id: true, name: true, code: true, branch: { select: { name: true } } } },
      workOrders: { select: { id: true, woNumber: true, status: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
    orderBy: { dueDate: "asc" },
    take: 100,
  }).then(schedules => schedules.map(s => ({ ...s, isOverdue: s.status === "pending" && s.dueDate < now })))
}

export default async function SchedulesPage(props: { searchParams: Promise<{ status?: string; machineId?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const companyId = session!.user.companyId as string
  const schedules = await getSchedules(companyId, searchParams.status, searchParams.machineId)

  const now = new Date()
  const overdue = schedules.filter(s => s.status === "pending" && s.dueDate < now).length
  const upcoming = schedules.filter(s => s.status === "pending" && s.dueDate >= now && s.dueDate <= new Date(now.getTime() + 7 * 86400000)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ตารางงานซ่อมบำรุง</h1>
          <p className="text-slate-500 text-sm mt-1">กำหนดการทั้งหมด {schedules.length} รายการ</p>
        </div>
        <Link
          href="/api/cron/generate-schedules"
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          สร้างกำหนดการอัตโนมัติ
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ทั้งหมด", value: schedules.length, color: "bg-slate-500" },
          { label: "เกินกำหนด", value: overdue, color: "bg-red-500" },
          { label: "ครบใน 7 วัน", value: upcoming, color: "bg-amber-500" },
          { label: "เสร็จสิ้น", value: schedules.filter(s => s.status === "completed").length, color: "bg-green-500" },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-500 text-xs font-medium">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color === "bg-red-500" && overdue > 0 ? "text-red-600" : "text-slate-800"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          { value: "", label: "ทั้งหมด" },
          { value: "pending", label: "รอดำเนินการ" },
          { value: "in_progress", label: "กำลังดำเนินการ" },
          { value: "completed", label: "เสร็จสิ้น" },
          { value: "cancelled", label: "ยกเลิก" },
        ].map(f => (
          <Link
            key={f.value}
            href={f.value ? `/maintenance/schedules?status=${f.value}` : "/maintenance/schedules"}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              (searchParams.status ?? "") === f.value
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <CalendarDays className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">ไม่มีกำหนดการ</p>
            <p className="text-sm mt-1">ลองสร้างแผนซ่อมบำรุงและกดสร้างกำหนดการอัตโนมัติ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["กำหนดการ", "เครื่องจักร", "ประเภท", "แผน", "ใบสั่งงาน", "สถานะ", ""].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map(schedule => {
                  const StatusIcon = statusConfig[schedule.status]?.icon ?? Clock
                  const isOverdue = schedule.status === "pending" && schedule.dueDate < now
                  return (
                    <tr key={schedule.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50/30" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <div>
                            <p className={`font-medium ${isOverdue ? "text-red-700" : "text-slate-800"}`}>
                              {formatDate(schedule.dueDate)}
                            </p>
                            {schedule.isAutoGenerated && (
                              <span className="text-xs text-slate-400">Auto</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/machines/${schedule.machine.id}`} className="hover:text-blue-600 transition-colors">
                          <p className="font-medium text-slate-800">{schedule.machine.name}</p>
                          <p className="text-xs text-slate-400">{schedule.machine.code} · {schedule.machine.branch.name}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: `${schedule.plan.type.color ?? "#6b7280"}18`,
                            color: schedule.plan.type.color ?? "#6b7280",
                          }}
                        >
                          {schedule.plan.type.code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/maintenance/plans/${schedule.plan.id}`} className="text-slate-700 hover:text-blue-600 text-sm">
                          {schedule.plan.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        {schedule.workOrders[0] ? (
                          <Link href={`/work-orders/${schedule.workOrders[0].id}`} className="text-blue-600 hover:underline text-xs">
                            {schedule.workOrders[0].woNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-xs">ยังไม่มี</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className="w-3.5 h-3.5 text-slate-400" />
                          <Badge variant={statusConfig[schedule.status]?.variant ?? "default"}>
                            {statusConfig[schedule.status]?.label ?? schedule.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 flex items-center justify-end">
                        <DeleteButton url={`/api/schedules/${schedule.id}`} confirmMessage="คุณต้องการลบกำหนดการนี้ใช่หรือไม่? (ไม่สามารถลบได้หากมีการสร้างใบสั่งงานแล้ว)" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
