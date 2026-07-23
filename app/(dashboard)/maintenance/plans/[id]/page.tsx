import { Metadata } from "next"
import { ArrowLeft, Edit, Calendar, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { DeleteButton } from "@/components/ui/delete-button"

export const metadata: Metadata = { title: "รายละเอียดแผนซ่อมบำรุง" }

const freqLabel: Record<string, string> = {
  day: "วัน", week: "สัปดาห์", month: "เดือน",
  quarter: "ไตรมาส", year: "ปี", runtime_hour: "ชั่วโมงรัน",
}

const statusLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  pending: { label: "รอดำเนินการ", variant: "warning" },
  in_progress: { label: "กำลังดำเนินการ", variant: "default" },
  completed: { label: "เสร็จสิ้น", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "danger" },
}

async function getPlan(id: string, companyId: string) {
  const plan = await prisma.maintenancePlan.findFirst({
    where: { id, machine: { branch: { companyId } } },
    include: {
      machine: { select: { id: true, name: true, code: true, branch: { select: { name: true } } } },
      type: { select: { id: true, name: true, code: true, color: true } },
      planChecklistTemplates: {
        include: { template: { include: { items: { orderBy: { sequence: "asc" } } } } },
      },
      schedules: {
        orderBy: { dueDate: "desc" },
        take: 10,
        include: { workOrders: { select: { id: true, woNumber: true, status: true }, take: 1 } },
      },
    },
  })
  return plan
}

export default async function MaintenancePlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  const plan = await getPlan(params.id, session!.user.companyId as string)
  if (!plan) return notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/maintenance/plans" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{plan.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{plan.machine.name} ({plan.machine.code})</p>
          </div>
        </div>
        <div className="flex gap-2">
          <DeleteButton 
            url={`/api/maintenance-plans/${params.id}`} 
            confirmMessage="คุณต้องการลบแผนซ่อมบำรุงนี้ใช่หรือไม่?" 
            redirectUrl="/maintenance/plans"
            className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
            iconOnly={false}
          />
          <Link
            href={`/maintenance/plans/${params.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
            แก้ไข
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="none">
            <CardHeader><CardTitle>ข้อมูลแผน</CardTitle></CardHeader>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">เครื่องจักร</p>
                  <p className="font-medium text-slate-800">{plan.machine.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{plan.machine.branch.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">ประเภทการซ่อมบำรุง</p>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border"
                    style={{
                      backgroundColor: `${plan.type.color ?? "#6b7280"}18`,
                      color: plan.type.color ?? "#6b7280",
                      borderColor: `${plan.type.color ?? "#6b7280"}40`,
                    }}
                  >
                    {plan.type.code}
                  </span>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">ความถี่</p>
                  <p className="font-medium text-slate-800">
                    ทุก {plan.frequencyValue} {freqLabel[plan.frequencyUnit] ?? plan.frequencyUnit}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">ระยะเวลาโดยประมาณ</p>
                  <p className="font-medium text-slate-800">
                    {plan.estimatedDurationMin ? `~${plan.estimatedDurationMin} นาที` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">วันที่เริ่มต้น</p>
                  <p className="font-medium text-slate-800">{formatDate(plan.startDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">วันที่สิ้นสุด</p>
                  <p className="font-medium text-slate-800">{plan.endDate ? formatDate(plan.endDate) : "ไม่ระบุ"}</p>
                </div>
              </div>
              {plan.description && (
                <div className="pt-2">
                  <p className="text-slate-600 font-medium mb-1.5 text-sm pb-1 border-b">ขอบเขตการทำงาน (Scope of Work)</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-lg border">{plan.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <Badge variant={plan.isActive ? "success" : "default"}>
                  {plan.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                </Badge>
                <p className="text-slate-400 text-xs">
                  สร้างเมื่อ {formatDate(plan.createdAt)}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="none">
            <CardHeader>
              <CardTitle>กำหนดการล่าสุด</CardTitle>
              <Link href={`/maintenance/schedules?planId=${plan.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                ดูทั้งหมด →
              </Link>
            </CardHeader>
            {plan.schedules.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">ยังไม่มีกำหนดการ</p>
            ) : (
              <div className="space-y-2 px-5 pb-5">
                {plan.schedules.map((schedule: NonNullable<typeof plan>["schedules"][number]) => (
                  <div key={schedule.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{formatDate(schedule.dueDate)}</p>
                        {schedule.workOrders[0] && (
                          <p className="text-xs text-slate-500 mt-0.5">{schedule.workOrders[0].woNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusLabel[schedule.status]?.variant ?? "default"}>
                        {statusLabel[schedule.status]?.label ?? schedule.status}
                      </Badge>
                      {schedule.isAutoGenerated && (
                        <span className="text-xs text-slate-400">Auto</span>
                      )}
                      <DeleteButton url={`/api/schedules/${schedule.id}`} confirmMessage="ลบกำหนดการนี้ใช่หรือไม่?" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card padding="none">
            <CardHeader><CardTitle>สถิติ</CardTitle></CardHeader>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">จำนวนกำหนดการทั้งหมด</span>
                <span className="text-sm font-semibold text-slate-800">{plan.schedules.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">เสร็จสิ้น</span>
                <span className="text-sm font-semibold text-green-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "completed").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">รอดำเนินการ</span>
                <span className="text-sm font-semibold text-yellow-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "pending").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">กำลังดำเนินการ</span>
                <span className="text-sm font-semibold text-blue-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "in_progress").length}
                </span>
              </div>
            </div>
          </Card>

          <Card padding="none">
            <CardHeader><CardTitle>ดำเนินการ</CardTitle></CardHeader>
            <div className="px-5 pb-5 space-y-3">
              <Link
                href={`/maintenance/schedules/new?planId=${plan.id}`}
                className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                สร้างกำหนดการใหม่
              </Link>
              <Link
                href={`/maintenance/plans/${params.id}/edit`}
                className="block w-full text-center px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                แก้ไขแผน
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
