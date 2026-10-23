import { Metadata } from "next"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { formatDate } from "@/lib/utils"
import { hasPermission, type UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { getWorkOrderDetailForPage } from "@/modules/work_orders"
import { resolveTarget, targetHref } from "@/modules/maintenance"
import { WORK_ORDER_STATUS_LABEL, type WorkOrderStatusName } from "@/modules/work_orders/application/work-order-transitions"
import { WorkOrderTransitionPanel } from "../work-order-transition-panel"
import { WorkOrderLaborPanel } from "../work-order-labor-panel"
import { WorkOrderChecklistPanel } from "../work-order-checklist-panel"

export const metadata: Metadata = { title: "รายละเอียดใบสั่งงาน" }

const priorityLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  low: { label: "ต่ำ", variant: "default" },
  medium: { label: "ปานกลาง", variant: "default" },
  high: { label: "สูง", variant: "warning" },
  critical: { label: "วิกฤต", variant: "danger" },
}

const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  draft: "default",
  open: "warning",
  assigned: "warning",
  in_progress: "default",
  on_hold: "warning",
  ready_for_handover: "warning",
  handed_over: "default",
  completed: "success",
  closed: "success",
  cancelled: "danger",
}

export default async function WorkOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  const roles = session!.user.roles as UserRole[]
  const workOrder = await getWorkOrderDetailForPage(prisma, {
    id: params.id,
    companyId: session!.user.companyId as string,
    roles,
  })
  if (!workOrder) return notFound()
  const canUpdate = hasPermission(roles, workOrder.branchId, "work_orders", "update")
  const target = resolveTarget(workOrder)

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

      <WorkOrderTransitionPanel workOrderId={params.id} status={workOrder.status} />
      <WorkOrderLaborPanel workOrderId={params.id} canUpdate={canUpdate} />
      <WorkOrderChecklistPanel workOrderId={params.id} canUpdate={canUpdate} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard padding="none">
            <GlassCardHeader><GlassCardTitle>ข้อมูลใบสั่งงาน</GlassCardTitle></GlassCardHeader>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">
                    {target ? (target.kind === "machine" ? "เครื่องจักร" : "ทรัพย์สิน") : "แจ้งซ่อม"}
                  </p>
                  {target ? (
                    <Link href={targetHref(target)} className="font-medium text-foreground hover:text-blue-600">
                      {target.name} ({target.code})
                    </Link>
                  ) : (
                    <p className="font-medium text-foreground">งานทั่วไป</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {target?.branchName ?? workOrder.branch.name}
                    {target?.kind === "asset" && workOrder.machine && (
                      <>
                        {" · เครื่องจักร "}
                        <Link href={`/machines/${workOrder.machine.id}`} className="hover:text-blue-600">
                          {workOrder.machine.code}
                        </Link>
                      </>
                    )}
                  </p>
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
                  <Badge variant={statusVariant[workOrder.status] ?? "default"}>
                    {WORK_ORDER_STATUS_LABEL[workOrder.status as WorkOrderStatusName] ?? workOrder.status}
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

          {workOrder.statusHistory.length > 0 && (
            <GlassCard padding="none">
              <GlassCardHeader><GlassCardTitle>ประวัติสถานะ</GlassCardTitle></GlassCardHeader>
              <div className="px-5 pb-5 space-y-2">
                {workOrder.statusHistory.map((row: { id: string; fromStatus: string | null; toStatus: string; reason: string | null; changedAt: Date }) => (
                  <p key={row.id} className="text-sm text-foreground">
                    {row.fromStatus ? `${WORK_ORDER_STATUS_LABEL[row.fromStatus as WorkOrderStatusName] ?? row.fromStatus} → ` : ""}
                    {WORK_ORDER_STATUS_LABEL[row.toStatus as WorkOrderStatusName] ?? row.toStatus}
                    {row.reason ? ` · ${row.reason}` : ""}
                    <span className="text-muted-foreground"> · {formatDate(row.changedAt)}</span>
                  </p>
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
              {workOrder.sourceWorkOrder && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">สร้างจากผลตรวจของใบ PM</p>
                  <Link
                    href={`/work-orders/${workOrder.sourceWorkOrder.id}`}
                    className="block p-2 bg-muted rounded text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {workOrder.sourceWorkOrder.woNumber} · {workOrder.sourceWorkOrder.title}
                  </Link>
                </div>
              )}
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
