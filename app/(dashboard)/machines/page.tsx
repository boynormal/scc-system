import { Suspense } from "react"
import { Metadata } from "next"
import { Plus, Wrench, ImageIcon } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { MachineStatusBadge } from "@/components/machines/machine-status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"
import { MachineFilters } from "@/components/machines/machine-filters"

export const metadata: Metadata = { title: "เครื่องจักร" }

const criticalLabels = ["", "ต่ำ", "ปานกลาง", "สูง", "วิกฤต"]
const criticalColors = ["", "text-green-600", "text-yellow-600", "text-orange-600", "text-red-600"]

async function getMachines(companyId: string, search?: string, categoryId?: string, status?: string, branchId?: string) {
  return prisma.machine.findMany({
    where: {
      deletedAt: null,
      branch: { companyId },
      ...(status && { status: status as never }),
      ...(categoryId && { categoryId }),
      ...(branchId && { branchId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { manufacturer: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      category: { select: { name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
      _count: { select: { maintenancePlans: true, workOrders: true } },
    },
    orderBy: [{ status: "asc" }, { branch: { name: "asc" } }, { name: "asc" }],
  })
}

async function getCategories(companyId: string) {
  return prisma.machineCategory.findMany({ where: { companyId }, orderBy: { name: "asc" } })
}

async function getBranches(companyId: string) {
  return prisma.branch.findMany({ where: { companyId }, orderBy: { name: "asc" } })
}

export default async function MachinesPage(
  props: {
    searchParams: Promise<{ search?: string; categoryId?: string; status?: string; branchId?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const [machines, categories, branches] = await Promise.all([
    getMachines(session!.user.companyId as string, searchParams.search, searchParams.categoryId, searchParams.status, searchParams.branchId),
    getCategories(session!.user.companyId as string),
    getBranches(session!.user.companyId as string),
  ])

  type MachineSummary = Awaited<ReturnType<typeof getMachines>>[number]
  const counts = {
    total: machines.length,
    active: machines.filter((m: MachineSummary) => m.status === "active").length,
    maintenance: machines.filter((m: MachineSummary) => m.status === "under_maintenance").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เครื่องจักร</h1>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {counts.total} เครื่อง · ใช้งาน {counts.active} · กำลังซ่อม {counts.maintenance}
          </p>
        </div>
        <Link
          href="/machines/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          เพิ่มเครื่องจักร
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <Suspense fallback={<div className="h-10 animate-pulse bg-slate-100 rounded-lg w-full"></div>}>
          <MachineFilters branches={branches} categories={categories} />
        </Suspense>
      </Card>

      {/* Table */}
      <Card padding="none">
        {machines.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="ยังไม่มีเครื่องจักร"
            description="เริ่มต้นโดยเพิ่มเครื่องจักรเครื่องแรก"
            action={
              <Link
                href="/machines/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
              >
                <Plus className="w-4 h-4" /> เพิ่มเครื่องจักร
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 w-16" />
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[150px]">สาขา / แผนก</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide min-w-[180px]">รหัส / ชื่อ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide bg-slate-50 sticky top-0">หมวดหมู่</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide bg-slate-50 sticky top-0">ความเสี่ยง</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">สถานะ</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">แผน/WO</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {machines.map((machine: any) => (
                  <tr key={machine.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      {machine.images?.[0]?.fileUrl ? (
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-slate-200 flex-shrink-0">
                          <img
                            src={machine.images[0].fileUrl}
                            alt={machine.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{machine.branch.name}</p>
                      {machine.department && (
                        <p className="text-slate-400 text-xs mt-0.5">{machine.department.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{machine.code}</p>
                      <p className="text-slate-500 text-sm mt-0.5">{machine.name}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{machine.category.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium ${criticalColors[machine.criticalLevel]}`}>
                        {criticalLabels[machine.criticalLevel]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <MachineStatusBadge status={machine.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {machine._count.maintenancePlans} แผน · {machine._count.workOrders} WO
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/machines/${machine.id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        ดูรายละเอียด →
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
