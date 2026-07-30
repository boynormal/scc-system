import { Suspense } from "react"
import { Metadata } from "next"
import Image from "next/image"
import { Plus, Wrench, ImageIcon } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { MachineStatusBadge } from "@/components/machines/machine-status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { MachineFilters } from "@/components/machines/machine-filters"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import type { Prisma } from "@prisma/client"

export const metadata: Metadata = { title: "เครื่องจักร" }

const criticalLabels = ["", "ต่ำ", "ปานกลาง", "สูง", "วิกฤต"]
const criticalColors = ["", "text-green-600", "text-yellow-600", "text-orange-600", "text-red-600"]

function machineWhere(
  companyId: string,
  search?: string,
  categoryId?: string,
  status?: string,
  branchId?: string
): Prisma.MachineWhereInput {
  return {
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
  }
}

async function getMachinesPage(
  companyId: string,
  page: number,
  search?: string,
  categoryId?: string,
  status?: string,
  branchId?: string
) {
  const where = machineWhere(companyId, search, categoryId, status, branchId)
  const skip = (page - 1) * SSR_PAGE_SIZE
  const baseWhereNoStatus = machineWhere(companyId, search, categoryId, undefined, branchId)

  const [machines, total, active, maintenance] = await Promise.all([
    prisma.machine.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        department: { select: { name: true } },
        category: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { fileUrl: true } },
        _count: { select: { maintenancePlans: true, workOrders: true } },
      },
      orderBy: [{ status: "asc" }, { branch: { name: "asc" } }, { name: "asc" }],
      skip,
      take: SSR_PAGE_SIZE,
    }),
    prisma.machine.count({ where }),
    prisma.machine.count({ where: { ...baseWhereNoStatus, status: "active" } }),
    prisma.machine.count({ where: { ...baseWhereNoStatus, status: "under_maintenance" } }),
  ])

  return { machines, total, active, maintenance }
}

async function getCategories(companyId: string) {
  return prisma.machineCategory.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

async function getBranches(companyId: string) {
  return prisma.branch.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export default async function MachinesPage(
  props: {
    searchParams: Promise<{
      search?: string
      categoryId?: string
      status?: string
      branchId?: string
      page?: string
    }>
  }
) {
  const searchParams = await props.searchParams
  const page = parsePage(searchParams.page)
  const session = await auth()
  const companyId = session!.user.companyId as string
  const [{ machines, total, active, maintenance }, categories, branches] = await Promise.all([
    getMachinesPage(
      companyId,
      page,
      searchParams.search,
      searchParams.categoryId,
      searchParams.status,
      searchParams.branchId
    ),
    getCategories(companyId),
    getBranches(companyId),
  ])

  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    categoryId: searchParams.categoryId,
    status: searchParams.status,
    branchId: searchParams.branchId,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">เครื่องจักร</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ทั้งหมด {total} เครื่อง · ใช้งาน {active} · กำลังซ่อม {maintenance}
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

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-lg w-full"></div>}>
          <MachineFilters branches={branches} categories={categories} />
        </Suspense>
      </GlassCard>

      <GlassCard padding="none">
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-5 py-3 w-16" />
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide min-w-[150px]">สาขา / แผนก</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide min-w-[180px]">รหัส / ชื่อ</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide bg-muted sticky top-0">หมวดหมู่</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide bg-muted sticky top-0">ความเสี่ยง</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">สถานะ</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">แผน/WO</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {machines.map((machine) => (
                    <tr key={machine.id} className="hover:bg-muted/60 transition-colors">
                      <td className="px-5 py-3.5">
                        {machine.images?.[0]?.fileUrl ? (
                          <div className="relative w-10 h-10 rounded-md overflow-hidden border border-border flex-shrink-0">
                            <Image
                              src={machine.images[0].fileUrl}
                              alt={machine.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{machine.branch.name}</p>
                        {machine.department && (
                          <p className="text-muted-foreground text-xs mt-0.5">{machine.department.name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{machine.code}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{machine.name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{machine.category.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium ${criticalColors[machine.criticalLevel]}`}>
                          {criticalLabels[machine.criticalLevel]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <MachineStatusBadge status={machine.status} />
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">
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
            <ListPagination
              pathname="/machines"
              page={page}
              totalPages={totalPages}
              total={total}
              query={paginationQuery}
            />
          </>
        )}
      </GlassCard>
    </div>
  )
}
