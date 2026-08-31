import { Suspense } from "react"
import { Metadata } from "next"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { listAccessiblePersonnelBranches, listPersonnel, listPersonnelDepartments } from "@/modules/hr"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/glass"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { PersonnelFilters } from "./personnel-filters"

export const metadata: Metadata = { title: "บุคลากร" }

function canRead(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

function canCreate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "create"))
  )
}

export default async function HrPersonnelPage(props: {
  searchParams: Promise<{ search?: string; branchId?: string; isActive?: string; departmentId?: string; page?: string }>
}) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canRead(roles)) redirect("/")

  const companyId = session.user.companyId as string
  const page = parsePage(searchParams.page)
  const isActiveRaw = searchParams.isActive
  const isActive = isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : null

  const [{ data: list, total }, { data: branches }, { data: departments }] = await Promise.all([
    listPersonnel(prisma, {
      companyId,
      roles,
      branchId: searchParams.branchId,
      search: searchParams.search,
      isActive,
      departmentId: searchParams.departmentId,
      page,
      pageSize: SSR_PAGE_SIZE,
    }),
    listAccessiblePersonnelBranches(prisma, { companyId, roles }),
    listPersonnelDepartments(prisma, {
      companyId,
      roles,
      branchIds: searchParams.branchId ? [searchParams.branchId] : undefined,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    branchId: searchParams.branchId,
    isActive: searchParams.isActive,
    departmentId: searchParams.departmentId,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">บุคลากร</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ข้อมูลคน · รหัสรายชื่อ (roster) ต่อบริษัท · สามารถผูกหลายสาขาเพื่อลงเวลา/นำเข้า Excel ได้หลายที่
          </p>
        </div>
        {canCreate(roles) && (
          <Link
            href="/hr/personnel/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม
          </Link>
        )}
      </div>

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />}>
          <PersonnelFilters branches={branches} departments={departments} />
        </Suspense>
      </GlassCard>

      <GlassCard padding="none">
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="ยังไม่มีข้อมูล"
            description="เพิ่มรายชื่อ หรือนำเข้าไฟล์บันทึกเวลา ระบบจะสร้าง / อัปเดตอัตโนมัติ"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                    <th className="p-3 font-medium">รหัสรายชื่อ</th>
                    <th className="p-3 font-medium">ชื่อแสดง</th>
                    <th className="p-3 font-medium">กลุ่มงาน</th>
                    <th className="p-3 font-medium">แผนก</th>
                    <th className="p-3 font-medium">สาขา</th>
                    <th className="p-3 font-medium">บัญชีผู้ใช้</th>
                    <th className="p-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/60/80">
                      <td className="p-3 font-mono text-foreground">
                        <Link href={`/hr/personnel/${p.id}`} className="text-blue-700 hover:underline">
                          {p.rosterNo}
                        </Link>
                      </td>
                      <td className="p-3 text-foreground">
                        <Link href={`/hr/personnel/${p.id}`} className="hover:underline">
                          {p.displayName}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{p.jobGroup ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {p.department
                          ? p.department.code
                            ? `${p.department.name} (${p.department.code})`
                            : p.department.name
                          : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {p.branchAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.branchAssignments.map((a) => (
                              <Badge
                                key={a.id}
                                className={
                                  a.isPrimary
                                    ? "bg-blue-100 text-blue-800 font-medium"
                                    : "bg-muted text-foreground"
                                }
                              >
                                {a.branch.code}
                                {a.isPrimary ? " · หลัก" : ""}
                              </Badge>
                            ))}
                          </div>
                        ) : p.branch ? (
                          <span>
                            {p.branch.code} — {p.branch.name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() || p.user.username : "—"}
                      </td>
                      <td className="p-3">
                        {p.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-800">ใช้งาน</Badge>
                        ) : (
                          <Badge variant="outline">ปิด</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              pathname="/hr/personnel"
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
