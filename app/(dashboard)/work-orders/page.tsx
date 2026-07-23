import { Metadata } from "next"
import { ClipboardList, Plus, Search } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate } from "@/lib/utils"
import { prisma } from "@/shared/db"
import { getWorkOrdersForPage } from "@/modules/work_orders"

export const metadata: Metadata = { title: "ใบสั่งงาน" }

const priorityLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  low: { label: "ต่ำ", variant: "default" },
  medium: { label: "ปานกลาง", variant: "default" },
  high: { label: "สูง", variant: "warning" },
  critical: { label: "วิกฤต", variant: "danger" },
}

const statusLabel: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  draft: { label: "ร่าง", variant: "default" },
  open: { label: "เปิด", variant: "warning" },
  in_progress: { label: "กำลังดำเนินการ", variant: "default" },
  on_hold: { label: "พัก", variant: "warning" },
  completed: { label: "เสร็จสิ้น", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "danger" },
}

export default async function WorkOrdersPage(
  props: {
    searchParams: Promise<{ search?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const workOrders = await getWorkOrdersForPage(prisma, {
    companyId: session!.user.companyId as string,
    search: searchParams.search,
  })

  type WorkOrder = Awaited<ReturnType<typeof getWorkOrdersForPage>>[number]
  const active = workOrders.filter((wo: WorkOrder) => wo.status !== "completed" && wo.status !== "cancelled" && wo.status !== "on_hold").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ใบสั่งงาน</h1>
          <p className="text-slate-500 text-sm mt-1">
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

      <Card padding="sm">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="search"
              defaultValue={searchParams.search}
              placeholder="ค้นหาหัวข้อ, WO#, ผู้รับผิดชอบ..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">
            ค้นหา
          </button>
          {searchParams.search && (
            <Link href="/work-orders" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              ล้าง
            </Link>
          )}
        </form>
      </Card>

      <Card padding="none">
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
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">WO#</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">หัวข้อ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">เครื่องจักร</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ผู้รับผิดชอบ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">วันที่</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ความสำคัญ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">สถานะ</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((wo: WorkOrder) => (
                  <tr key={wo.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{wo.woNumber}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{wo.title}</p>
                      {wo.description && (
                        <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{wo.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-700 font-medium">{wo.machine.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{wo.machine.code}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {wo.assignee ? (
                        <p className="text-slate-700 text-sm">
                          {wo.assignee.firstName} {wo.assignee.lastName}
                        </p>
                      ) : (
                        <span className="text-slate-400 text-xs">ยังไม่มอบหมาย</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <p className="text-slate-500 text-xs">{formatDate(wo.createdAt)}</p>
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
                      <Badge variant={statusLabel[wo.status]?.variant ?? "default"}>
                        {statusLabel[wo.status]?.label ?? wo.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        ดู →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
