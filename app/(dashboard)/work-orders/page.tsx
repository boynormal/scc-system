import { Metadata } from "next"
import { ClipboardList, Plus, Search } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { formatDate } from "@/lib/utils"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { getWorkOrdersForPage } from "@/modules/work_orders"
import { resolveTarget, targetHref } from "@/modules/maintenance"
import { WORK_ORDER_STATUS_LABEL, type WorkOrderStatusName } from "@/modules/work_orders/application/work-order-transitions"

export const metadata: Metadata = { title: "ใบสั่งงาน" }

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

export default async function WorkOrdersPage(
  props: {
    searchParams: Promise<{ search?: string; machineId?: string; assetId?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const workOrders = await getWorkOrdersForPage(prisma, {
    companyId: session!.user.companyId as string,
    roles: session!.user.roles as UserRole[],
    search: searchParams.search,
    machineId: searchParams.machineId,
    assetId: searchParams.assetId,
  })
  const filterQuery = new URLSearchParams({
    ...(searchParams.machineId ? { machineId: searchParams.machineId } : {}),
    ...(searchParams.assetId ? { assetId: searchParams.assetId } : {}),
  }).toString()

  type WorkOrder = Awaited<ReturnType<typeof getWorkOrdersForPage>>[number]
  const inactive = new Set(["completed", "closed", "cancelled", "on_hold"])
  const active = workOrders.filter((wo: WorkOrder) => !inactive.has(wo.status)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ใบสั่งงาน</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ทั้งหมด {workOrders.length} ใบ · กำลังดำเนินการ {active} ใบ
          </p>
        </div>
        <Link
          href="/work-orders/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          สร้างใบสั่งงาน
        </Link>
      </div>

      <GlassCard padding="sm">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              name="search"
              defaultValue={searchParams.search}
              placeholder="ค้นหาหัวข้อ, WO#, ผู้รับผิดชอบ..."
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchParams.machineId && <input type="hidden" name="machineId" value={searchParams.machineId} />}
            {searchParams.assetId && <input type="hidden" name="assetId" value={searchParams.assetId} />}
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">
            ค้นหา
          </button>
          {searchParams.search && (
            <Link href={filterQuery ? `/work-orders?${filterQuery}` : "/work-orders"} className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-muted/60">
              ล้าง
            </Link>
          )}
        </form>
      </GlassCard>

      <GlassCard padding="none">
        {workOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="ยังไม่มีใบสั่งงาน"
            description="สร้างใบสั่งงานแรกเพื่อเริ่มติดตามการซ่อมบำรุง"
            action={
              <Link href="/work-orders/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
                <Plus className="w-4 h-4" /> สร้างใบสั่งงาน
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">WO#</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">หัวข้อ</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ทรัพย์สิน / เครื่องจักร</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ผู้รับผิดชอบ</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">วันที่</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ความสำคัญ</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">สถานะ</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workOrders.map((wo: WorkOrder) => {
                  const target = resolveTarget(wo)
                  return (
                  <tr key={wo.id} className="hover:bg-muted/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{wo.woNumber}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{wo.title}</p>
                      {wo.description && (
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{wo.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {target ? (
                        <Link href={targetHref(target)} className="hover:text-blue-600">
                          <p className="text-foreground font-medium">{target.name}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">{target.code}</p>
                        </Link>
                      ) : (
                        <p className="text-foreground font-medium">งานทั่วไป</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {wo.assignee ? (
                        <p className="text-foreground text-sm">
                          {wo.assignee.firstName} {wo.assignee.lastName}
                        </p>
                      ) : (
                        <span className="text-muted-foreground text-xs">ยังไม่มอบหมาย</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">{formatDate(wo.createdAt)}</p>
                        {wo.closedAt && (
                          <p className="text-green-600 text-xs">เสร็จ {formatDate(wo.closedAt)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={priorityLabel[wo.priority]?.variant ?? "default"}>
                        {priorityLabel[wo.priority]?.label ?? wo.priority}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={statusVariant[wo.status] ?? "default"}>
                        {WORK_ORDER_STATUS_LABEL[wo.status as WorkOrderStatusName] ?? wo.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        ดู →
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
