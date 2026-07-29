import { Metadata } from "next"
import { ArrowLeft, Edit, Calendar, Clock, User, FileText, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { formatDate } from "@/lib/utils"
import { prisma } from "@/shared/db"
import { getWorkOrderDetailForPage } from "@/modules/work_orders"

export const metadata: Metadata = { title: "รายละเอียดใบสั่งงาน" }

const priorityLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  low: { label: "ต่ำ", variant: "default" },
  medium: { label: "ปานกลาง", variant: "default" },
  high: { label: "สูง", variant: "warning" },
  critical: { label: "วิกฤต", variant: "danger" },
}

const statusLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  draft: { label: "ร่าง", variant: "default" } as const,
  open: { label: "รอดำเนินการ", variant: "warning" } as const,
  in_progress: { label: "กำลังดำเนินการ", variant: "default" },
  on_hold: { label: "ระงับชั่วคราว", variant: "warning" },
  completed: { label: "เสร็จสิ้น", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "danger" },
}

export default async function WorkOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  const workOrder = await getWorkOrderDetailForPage(prisma, {
    id: params.id,
    companyId: session!.user.companyId as string,
  })
  if (!workOrder) return notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/work-orders" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{workOrder.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{workOrder.woNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/work-orders/${params.id}/edit`}
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
            <GlassCardHeader><GlassCardTitle>ข้อมูลใบสั่งงาน</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">เครื่องจักร</p>
                  <p className="font-medium text-foreground">{workOrder.machine.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{workOrder.machine.branch.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">ความสำคัญ</p>
                  <Badge variant={priorityLabel[workOrder.priority]?.variant ?? "default"}>
                    {priorityLabel[workOrder.priority]?.label ?? workOrder.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">ผู้รับผิดชอบ</p>
                  {workOrder.assignee ? (
                    <p className="font-medium text-foreground">
                      {workOrder.assignee.firstName} {workOrder.assignee.lastName}
                    </p>
                  ) : (
                    <span className="text-muted-foreground text-sm">ยังไม่มอบหมาย</span>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Downtime (นาที)</p>
                  <p className="font-medium text-foreground">
                    {workOrder.downtimeMin > 0 ? `${workOrder.downtimeMin} นาที` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">วันที่สร้าง</p>
                  <p className="font-medium text-foreground">{formatDate(workOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">สถานะ</p>
                  <Badge variant={statusLabel[workOrder.status]?.variant ?? "default"}>
                    {statusLabel[workOrder.status]?.label ?? workOrder.status}
                  </Badge>
                </div>
              </div>
              {workOrder.description && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">รายละเอียด</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{workOrder.description}</p>
                </div>
              )}
              {(workOrder.actualStart || workOrder.actualEnd) && (
                <div className="grid grid-cols-2 gap-4">
                  {workOrder.actualStart && (
                    <div>
                      <p className="text-muted-foreground mb-1 text-sm">เริ่มจริง</p>
                      <p className="font-medium text-foreground">{formatDate(workOrder.actualStart)}</p>
                    </div>
                  )}
                  {workOrder.actualEnd && (
                    <div>
                      <p className="text-muted-foreground mb-1 text-sm">เสร็จจริง</p>
                      <p className="font-medium text-foreground">{formatDate(workOrder.actualEnd)}</p>
                    </div>
                  )}
                </div>
              )}
              {workOrder.closedAt && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">วันที่ปิด</p>
                  <p className="font-medium text-foreground">{formatDate(workOrder.closedAt)}</p>
                </div>
              )}
              {workOrder.rootCause && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">สาเหตุ (Root Cause)</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{workOrder.rootCause}</p>
                </div>
              )}
              {workOrder.correctiveAction && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">การแก้ไข (Corrective Action)</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{workOrder.correctiveAction}</p>
                </div>
              )}
              {workOrder.remarks && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">หมายเหตุ</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{workOrder.remarks}</p>
                </div>
              )}
            </div>
          </GlassCard>

          {workOrder.checklistResults.length > 0 && (
            <GlassCard padding="none">
              <GlassCardHeader><GlassCardTitle>ผลการตรวจสอบ Checklist</GlassCardTitle></GlassCardHeader>
              <div className="px-5 pb-5 space-y-2">
                {workOrder.checklistResults.map((result: NonNullable<typeof workOrder>["checklistResults"][number]) => (
                  <div key={result.id} className="flex items-center gap-3 p-2 bg-muted rounded">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      result.status === "pass" ? "bg-green-500 border-green-500" :
                      result.status === "fail" ? "bg-red-500 border-red-500" :
                      "border-border"
                    }`}>
                      {result.status === "pass" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      {result.status === "fail" && <XCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm text-foreground">{result.item.itemName}</span>
                    {result.actualValue && (
                      <span className="text-xs text-muted-foreground ml-auto">{result.actualValue}</span>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {workOrder.parts.length > 0 && (
            <GlassCard padding="none">
              <GlassCardHeader><GlassCardTitle>อะไหล่ที่ใช้</GlassCardTitle></GlassCardHeader>
              <div className="px-5 pb-5 space-y-2">
                {workOrder.parts.map((p: NonNullable<typeof workOrder>["parts"][number]) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.part.name}</p>
                      <p className="text-xs text-muted-foreground">{p.part.code}</p>
                    </div>
                    <p className="text-sm text-foreground">{p.qtyUsed} {p.part.unit}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        <div className="space-y-6">
          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>ข้อมูลเพิ่มเติม</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-3">
              {workOrder.schedule && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">เชื่อมโยงกับกำหนดการ</p>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-sm font-medium text-foreground">{workOrder.schedule.plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      กำหนด: {formatDate(workOrder.schedule.dueDate)}
                    </p>
                    {workOrder.schedule.plan.type && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-1"
                        style={{
                          backgroundColor: `${workOrder.schedule.plan.type.color ?? "#6b7280"}18`,
                          color: workOrder.schedule.plan.type.color ?? "#6b7280",
                        }}
                      >
                        {workOrder.schedule.plan.type.code}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {((workOrder.imagesBefore?.length > 0) || (workOrder.imagesAfter?.length > 0)) && (
            <GlassCard>
              <GlassCardHeader><GlassCardTitle>รูปภาพก่อน/หลังซ่อม</GlassCardTitle></GlassCardHeader>
              <div className="space-y-4">
                {workOrder.imagesBefore && Array.isArray(workOrder.imagesBefore) && (workOrder.imagesBefore as string[]).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">รูปก่อนซ่อม</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(workOrder.imagesBefore as string[]).map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                          <Image src={img} alt={`Before ${idx + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {workOrder.imagesAfter && Array.isArray(workOrder.imagesAfter) && (workOrder.imagesAfter as string[]).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">รูปหลังซ่อม</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(workOrder.imagesAfter as string[]).map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                          <Image src={img} alt={`After ${idx + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>ดำเนินการ</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-3">
              {workOrder.status === "open" && (
                <Link
                  href={`/work-orders/${params.id}/edit`}
                  className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  เริ่มดำเนินการ
                </Link>
              )}
              {workOrder.status === "in_progress" && (
                <Link
                  href={`/work-orders/${params.id}/edit`}
                  className="block w-full text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  บันทึกผลการดำเนินการ
                </Link>
              )}
              <Link
                href={`/work-orders/${params.id}/edit`}
                className="block w-full text-center px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors"
              >
                แก้ไขใบสั่งงาน
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
