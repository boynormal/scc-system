import { Metadata } from "next"
import { ArrowLeft, Edit, Calendar } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
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
          <Link href="/maintenance/plans" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{plan.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{plan.machine.name} ({plan.machine.code})</p>
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
          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>ข้อมูลแผน</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">เครื่องจักร</p>
                  <p className="font-medium text-foreground">{plan.machine.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{plan.machine.branch.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">ประเภทการซ่อมบำรุง</p>
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
                  <p className="text-muted-foreground mb-1">ความถี่</p>
                  <p className="font-medium text-foreground">
                    ทุก {plan.frequencyValue} {freqLabel[plan.frequencyUnit] ?? plan.frequencyUnit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">ระยะเวลาโดยประมาณ</p>
                  <p className="font-medium text-foreground">
                    {plan.estimatedDurationMin ? `~${plan.estimatedDurationMin} นาที` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">วันที่เริ่มต้น</p>
                  <p className="font-medium text-foreground">{formatDate(plan.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">วันที่สิ้นสุด</p>
                  <p className="font-medium text-foreground">{plan.endDate ? formatDate(plan.endDate) : "ไม่ระบุ"}</p>
                </div>
              </div>
              {plan.description && (
                <div className="pt-2">
                  <p className="text-muted-foreground font-medium mb-1.5 text-sm pb-1 border-b">ขอบเขตการทำงาน (Scope of Work)</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed bg-muted p-3 rounded-lg border">{plan.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <Badge variant={plan.isActive ? "success" : "default"}>
                  {plan.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                </Badge>
                <p className="text-muted-foreground text-xs">
                  สร้างเมื่อ {formatDate(plan.createdAt)}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard padding="none">
            <GlassCardHeader>
              <GlassCardTitle>กำหนดการล่าสุด</GlassCardTitle>
              <Link href={`/maintenance/schedules?planId=${plan.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                ดูทั้งหมด →
              </Link>
            </GlassCardHeader>
            {plan.schedules.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">ยังไม่มีกำหนดการ</p>
            ) : (
              <div className="space-y-2 px-5 pb-5">
                {plan.schedules.map((schedule: NonNullable<typeof plan>["schedules"][number]) => (
                  <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatDate(schedule.dueDate)}</p>
                        {schedule.workOrders[0] && (
                          <p className="text-xs text-muted-foreground mt-0.5">{schedule.workOrders[0].woNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusLabel[schedule.status]?.variant ?? "default"}>
                        {statusLabel[schedule.status]?.label ?? schedule.status}
                      </Badge>
                      {schedule.isAutoGenerated && (
                        <span className="text-xs text-muted-foreground">Auto</span>
                      )}
                      <DeleteButton url={`/api/schedules/${schedule.id}`} confirmMessage="ลบกำหนดการนี้ใช่หรือไม่?" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>สถิติ</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">จำนวนกำหนดการทั้งหมด</span>
                <span className="text-sm font-semibold text-foreground">{plan.schedules.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">เสร็จสิ้น</span>
                <span className="text-sm font-semibold text-green-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "completed").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">รอดำเนินการ</span>
                <span className="text-sm font-semibold text-yellow-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "pending").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">กำลังดำเนินการ</span>
                <span className="text-sm font-semibold text-blue-600">
                  {plan.schedules.filter((s: NonNullable<typeof plan>["schedules"][number]) => s.status === "in_progress").length}
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>ดำเนินการ</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-3">
              <Link
                href={`/maintenance/schedules/new?planId=${plan.id}`}
                className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                สร้างกำหนดการใหม่
              </Link>
              <Link
                href={`/maintenance/plans/${params.id}/edit`}
                className="block w-full text-center px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors"
              >
                แก้ไขแผน
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
