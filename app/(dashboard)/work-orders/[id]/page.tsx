import { Metadata } from "next"
import { ArrowLeft, Edit, Calendar, Clock, User, FileText, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
          <Link href="/work-orders" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{workOrder.title}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{workOrder.woNumber}</p>
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
          <Card padding="none">
            <CardHeader><CardTitle>ข้อมูลใบสั่งงาน</CardTitle></CardHeader>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">เครื่องจักร</p>
                  <p className="font-medium text-slate-800">{workOrder.machine.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{workOrder.machine.branch.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">ความสำคัญ</p>
                  <Badge variant={priorityLabel[workOrder.priority]?.variant ?? "default"}>
                    {priorityLabel[workOrder.priority]?.label ?? workOrder.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">ผู้รับผิดชอบ</p>
                  {workOrder.assignee ? (
                    <p className="font-medium text-slate-800">
                      {workOrder.assignee.firstName} {workOrder.assignee.lastName}
                    </p>
                  ) : (
                    <span className="text-slate-400 text-sm">ยังไม่มอบหมาย</span>
                  )}
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Downtime (นาที)</p>
                  <p className="font-medium text-slate-800">
                    {workOrder.downtimeMin > 0 ? `${workOrder.downtimeMin} นาที` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">วันที่สร้าง</p>
                  <p className="font-medium text-slate-800">{formatDate(workOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">สถานะ</p>
                  <Badge variant={statusLabel[workOrder.status]?.variant ?? "default"}>
                    {statusLabel[workOrder.status]?.label ?? workOrder.status}
                  </Badge>
                </div>
              </div>
              {workOrder.description && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">รายละเอียด</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{workOrder.description}</p>
                </div>
              )}
              {(workOrder.actualStart || workOrder.actualEnd) && (
                <div className="grid grid-cols-2 gap-4">
                  {workOrder.actualStart && (
                    <div>
                      <p className="text-slate-400 mb-1 text-sm">เริ่มจริง</p>
                      <p className="font-medium text-slate-800">{formatDate(workOrder.actualStart)}</p>
                    </div>
                  )}
                  {workOrder.actualEnd && (
                    <div>
                      <p className="text-slate-400 mb-1 text-sm">เสร็จจริง</p>
                      <p className="font-medium text-slate-800">{formatDate(workOrder.actualEnd)}</p>
                    </div>
                  )}
                </div>
              )}
              {workOrder.closedAt && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">วันที่ปิด</p>
                  <p className="font-medium text-slate-800">{formatDate(workOrder.closedAt)}</p>
                </div>
              )}
              {workOrder.rootCause && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">สาเหตุ (Root Cause)</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{workOrder.rootCause}</p>
                </div>
              )}
              {workOrder.correctiveAction && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">การแก้ไข (Corrective Action)</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{workOrder.correctiveAction}</p>
                </div>
              )}
              {workOrder.remarks && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">หมายเหตุ</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{workOrder.remarks}</p>
                </div>
              )}
            </div>
          </Card>

          {workOrder.checklistResults.length > 0 && (
            <Card padding="none">
              <CardHeader><CardTitle>ผลการตรวจสอบ Checklist</CardTitle></CardHeader>
              <div className="px-5 pb-5 space-y-2">
                {workOrder.checklistResults.map((result: NonNullable<typeof workOrder>["checklistResults"][number]) => (
                  <div key={result.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      result.status === "pass" ? "bg-green-500 border-green-500" :
                      result.status === "fail" ? "bg-red-500 border-red-500" :
                      "border-slate-300"
                    }`}>
                      {result.status === "pass" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      {result.status === "fail" && <XCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm text-slate-700">{result.item.itemName}</span>
                    {result.actualValue && (
                      <span className="text-xs text-slate-500 ml-auto">{result.actualValue}</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {workOrder.parts.length > 0 && (
            <Card padding="none">
              <CardHeader><CardTitle>อะไหล่ที่ใช้</CardTitle></CardHeader>
              <div className="px-5 pb-5 space-y-2">
                {workOrder.parts.map((p: NonNullable<typeof workOrder>["parts"][number]) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.part.name}</p>
                      <p className="text-xs text-slate-500">{p.part.code}</p>
                    </div>
                    <p className="text-sm text-slate-700">{p.qtyUsed} {p.part.unit}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card padding="none">
            <CardHeader><CardTitle>ข้อมูลเพิ่มเติม</CardTitle></CardHeader>
            <div className="px-5 pb-5 space-y-3">
              {workOrder.schedule && (
                <div>
                  <p className="text-slate-400 mb-1 text-sm">เชื่อมโยงกับกำหนดการ</p>
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-sm font-medium text-slate-800">{workOrder.schedule.plan.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
          </Card>

          {((workOrder.imagesBefore?.length > 0) || (workOrder.imagesAfter?.length > 0)) && (
            <Card>
              <CardHeader><CardTitle>รูปภาพก่อน/หลังซ่อม</CardTitle></CardHeader>
              <div className="space-y-4">
                {workOrder.imagesBefore && Array.isArray(workOrder.imagesBefore) && (workOrder.imagesBefore as string[]).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">รูปก่อนซ่อม</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(workOrder.imagesBefore as string[]).map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                          <Image src={img} alt={`Before ${idx + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {workOrder.imagesAfter && Array.isArray(workOrder.imagesAfter) && (workOrder.imagesAfter as string[]).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">รูปหลังซ่อม</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(workOrder.imagesAfter as string[]).map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                          <Image src={img} alt={`After ${idx + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card padding="none">
            <CardHeader><CardTitle>ดำเนินการ</CardTitle></CardHeader>
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
                className="block w-full text-center px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                แก้ไขใบสั่งงาน
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
