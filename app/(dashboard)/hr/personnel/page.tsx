import { Suspense } from "react"
import { Metadata } from "next"
import Link from "next/link"
import { Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { countActivePersonnelByBranch, listAccessiblePersonnelBranches, listPersonnel, listPersonnelDepartments } from "@/modules/hr"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { PersonnelFilters } from "./personnel-filters"
import { PersonnelCreateButton } from "./personnel-create-button"
import { PersonnelRowActions } from "./personnel-row-actions"
import { personnelDateTimeInput } from "@/modules/hr/application/personnel-date-time"
import { ListFrame } from "@/components/shell/list-frame"
import { SubTabs } from "@/components/shell/sub-tabs"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"

export const metadata: Metadata = { title: "บุคลากร" }

function dateInput(value: Date | null): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

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

function canUpdate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "update"))
  )
}

function canDelete(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "delete"))
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
  const isActive = isActiveRaw === "false" ? false : isActiveRaw === "all" ? null : true

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
    listPersonnelDepartments(prisma, { companyId, roles }),
  ])
  const activeCounts = await countActivePersonnelByBranch(prisma, {
    companyId,
    roles,
    branchIds: branches.map((branch) => branch.id),
  })
  const activeTotal = Object.values(activeCounts).reduce((sum, count) => sum + count, 0)

  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    branchId: searchParams.branchId,
    isActive: searchParams.isActive,
    departmentId: searchParams.departmentId,
  }

  const branchHref = (branchId?: string) => {
    const params = new URLSearchParams()
    if (searchParams.search) params.set("search", searchParams.search)
    if (searchParams.isActive) params.set("isActive", searchParams.isActive)
    if (searchParams.departmentId) params.set("departmentId", searchParams.departmentId)
    if (branchId) params.set("branchId", branchId)
    const query = params.toString()
    return query ? `/hr/personnel?${query}` : "/hr/personnel"
  }

  return (
    <div className="space-y-4">
      {branches.length > 1 && (
        <SubTabs
          aria-label="สาขา"
          activeKey={searchParams.branchId || "all"}
          items={[
            { key: "all", label: "ทั้งหมด", count: activeTotal, href: branchHref() },
            ...[...branches]
              .sort((a, b) => compareBranchTabName(a.name, b.name))
              .map((branch) => ({
              key: branch.id,
              label: branch.name,
              count: activeCounts[branch.id] ?? 0,
              href: branchHref(branch.id),
            })),
          ]}
        />
      )}
      <ListFrame
        filters={
          <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />}>
            <PersonnelFilters
              departments={departments}
              action={canCreate(roles) ? <PersonnelCreateButton branches={branches} departments={departments} /> : null}
            />
          </Suspense>
        }
      >
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
                    <th className="p-3 font-medium">ชื่อเรียก</th>
                    <th className="p-3 font-medium">กลุ่มงาน</th>
                    <th className="p-3 font-medium">สาขา</th>
                    <th className="p-3 font-medium">สถานะ</th>
                    <th className="p-3 font-medium text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const primary = p.branchAssignments.find((a) => a.isPrimary)?.branch ?? p.branch
                    return (
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
                      <td className="p-3 text-foreground">{p.department?.name ?? p.jobGroup ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {primary ? `${primary.code} — ${primary.name}` : "—"}
                      </td>
                      <td className="p-3">
                        {p.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-800">ใช้งาน</Badge>
                        ) : (
                          <Badge variant="outline">ปิด</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <PersonnelRowActions
                          person={{
                            id: p.id,
                            rosterNo: p.rosterNo,
                            displayName: p.displayName,
                            jobGroup: p.department?.name ?? p.jobGroup,
                            departmentId: p.departmentId,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            idCardNo: p.idCardNo,
                            phone: p.phone,
                            address: p.address,
                            notes: p.notes,
                            isActive: p.isActive,
                            branchId: primary?.id ?? p.branchId,
                            birthDate: dateInput(p.birthDate),
                            startDate: personnelDateTimeInput(p.startDate),
                            gender: p.gender,
                            nationality: p.nationality,
                            endDate: personnelDateTimeInput(p.endDate),
                            exitKind: p.exitKind,
                            branchLabel: primary ? `${primary.code} — ${primary.name}` : "—",
                          }}
                          branches={branches}
                          departments={departments}
                          canUpdate={canUpdate(roles)}
                          canDelete={canDelete(roles)}
                        />
                      </td>
                    </tr>
                    )
                  })}
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
      </ListFrame>
    </div>
  )
}
