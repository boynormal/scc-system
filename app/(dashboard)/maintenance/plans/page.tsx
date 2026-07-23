import { Metadata } from "next"
import { Factory, Plus, ImageIcon } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { DeleteButton } from "@/components/ui/delete-button"

export const metadata: Metadata = { title: "แผนซ่อมบำรุง" }

const freqLabel: Record<string, string> = {
  day: "วัน", week: "สัปดาห์", month: "เดือน",
  quarter: "ไตรมาส", year: "ปี", runtime_hour: "ชั่วโมงรัน",
}

async function getPlans(companyId: string, machineId?: string) {
  return prisma.maintenancePlan.findMany({
    where: {
      machine: { branch: { companyId } },
      ...(machineId && { machineId }),
    },
    include: {
      machine: { 
        select: { 
          id: true, 
          name: true, 
          code: true, 
          branch: { select: { name: true } },
          images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } }
        } 
      },
      type: { select: { id: true, name: true, code: true, color: true } },
      _count: { select: { schedules: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })
}

export default async function MaintenancePlansPage(
  props: {
    searchParams: Promise<{ machineId?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const plans = await getPlans(session!.user.companyId as string, searchParams.machineId)

  type Plan = Awaited<ReturnType<typeof getPlans>>[number]
  const active = plans.filter((p: Plan) => p.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แผนซ่อมบำรุง</h1>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {plans.length} แผน · ใช้งาน {active} แผน
          </p>
        </div>
        <Link
          href="/maintenance/plans/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          สร้างแผนใหม่
        </Link>
      </div>

      <Card padding="none">
        {plans.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="ยังไม่มีแผนซ่อมบำรุง"
            description="สร้างแผน PM/CM สำหรับเครื่องจักรของคุณ"
            action={
              <Link href="/maintenance/plans/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
                <Plus className="w-4 h-4" /> สร้างแผนใหม่
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-16"></th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">เครื่องจักร</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ชื่อแผน</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ประเภท</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ความถี่</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">กำหนดการ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">สถานะ</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan: Plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      {plan.machine.images?.[0] ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={plan.machine.images[0].fileUrl}
                            alt={plan.machine.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <Link href={`/machines/${plan.machine.id}`} className="hover:text-blue-600 transition-colors">
                        <p className="font-semibold text-slate-800">{plan.machine.code}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{plan.machine.name} · {plan.machine.branch.name}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{plan.name}</p>
                      {plan.estimatedDurationMin && (
                        <p className="text-slate-400 text-xs mt-0.5">~{plan.estimatedDurationMin} นาที</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border"
                        style={{
                          backgroundColor: `${plan.type.color || "#94a3b8"}18`,
                          color: plan.type.color || "#475569",
                          borderColor: `${plan.type.color || "#94a3b8"}40`,
                        }}
                      >
                        {plan.type.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      ทุก {plan.frequencyValue} {freqLabel[plan.frequencyUnit] ?? plan.frequencyUnit}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {plan._count.schedules} กำหนดการ
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={plan.isActive ? "success" : "default"}>
                        {plan.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 flex items-center justify-end gap-3">
                      <Link
                        href={`/maintenance/plans/${plan.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        ดูรายละเอียด
                      </Link>
                      <DeleteButton url={`/api/maintenance-plans/${plan.id}`} confirmMessage={`คุณต้องการลบแผน '${plan.name}' ใช่หรือไม่?`} />
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
