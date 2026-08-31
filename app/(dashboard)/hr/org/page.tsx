import { Suspense } from "react"
import { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import {
  getPersonnelOrgChart,
  getPersonnelOrgView,
  listAccessiblePersonnelBranches,
} from "@/modules/hr"
import { GlassCard } from "@/components/glass"
import { PersonnelOrgFilters } from "./personnel-org-filters"
import { PersonnelOrgView } from "./personnel-org-view"
import { OrgChart, UnplacedPersonnel } from "./org-chart"
import { OrgViewToolbar } from "./org-view-toolbar"

export const metadata: Metadata = { title: "ผังองค์กรบุคลากร" }

type OrgViewMode = "chart" | "dept"

function canRead(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

function parseIsActive(raw: string | undefined): boolean | null {
  if (raw === "false") return false
  if (raw === "all") return null
  return true
}

function parseView(raw: string | undefined): OrgViewMode {
  return raw === "dept" ? "dept" : "chart"
}

export default async function HrPersonnelOrgPage(props: {
  searchParams: Promise<{
    branchId?: string
    search?: string
    isActive?: string
    view?: string
  }>
}) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canRead(roles)) redirect("/")

  const companyId = session.user.companyId as string
  const { data: branches } = await listAccessiblePersonnelBranches(prisma, { companyId, roles })

  if (!searchParams.branchId && branches[0]) {
    const params = new URLSearchParams()
    params.set("branchId", branches[0].id)
    if (searchParams.search) params.set("search", searchParams.search)
    if (searchParams.isActive) params.set("isActive", searchParams.isActive)
    if (searchParams.view) params.set("view", searchParams.view)
    redirect(`/hr/org?${params.toString()}`)
  }

  const branchId = searchParams.branchId
  const view = parseView(searchParams.view)
  const isActive = parseIsActive(searchParams.isActive)
  const search = searchParams.search ?? ""

  let error: string | null = null
  let deptView = null as Awaited<ReturnType<typeof getPersonnelOrgView>>["data"] | null
  let chart = null as Awaited<ReturnType<typeof getPersonnelOrgChart>>["data"] | null

  if (branchId) {
    try {
      if (view === "dept") {
        const result = await getPersonnelOrgView(prisma, {
          companyId,
          roles,
          branchId,
          search: searchParams.search,
          isActive,
        })
        deptView = result.data
      } else {
        const result = await getPersonnelOrgChart(prisma, {
          companyId,
          roles,
          branchId,
          search: searchParams.search,
          isActive,
        })
        chart = result.data
      }
    } catch (e) {
      if (e instanceof ForbiddenError) {
        error = "ไม่มีสิทธิ์ในสาขาที่เลือก"
      } else if (e instanceof ValidationError) {
        error = e.message === "Invalid branch" ? "สาขาไม่ถูกต้อง" : e.message
      } else {
        throw e
      }
    }
  }

  const exportQuery = new URLSearchParams()
  if (branchId) exportQuery.set("branchId", branchId)
  if (searchParams.isActive) exportQuery.set("isActive", searchParams.isActive)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ผังองค์กรบุคลากร</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {view === "chart"
            ? "กล่องคือตำแหน่ง เส้นคือสายบังคับบัญชา — ตำแหน่งจัดได้ที่แท็บตำแหน่ง"
            : "มุมมองแผนกใช้แผนกบ้าน ไม่ใช่สาขาที่ลงเวลาได้"}
        </p>
      </div>

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />}>
          <PersonnelOrgFilters branches={branches} />
        </Suspense>
      </GlassCard>

      <Suspense fallback={<div className="h-9 w-full animate-pulse rounded-lg bg-muted" />}>
        <OrgViewToolbar
          view={view}
          printHref={`/hr/org/print?${exportQuery.toString()}`}
          exportHref={`/api/hr/org/export?${exportQuery.toString()}`}
          canExport={Boolean(branchId) && !error}
        />
      </Suspense>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      )}

      {!branchId && branches.length === 0 && (
        <GlassCard className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">เลือกสาขา</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ยังไม่มีสาขาที่สามารถดูโครงสร้างบุคลากรได้
          </p>
        </GlassCard>
      )}

      {chart && (
        <>
          <p className="text-sm text-muted-foreground">
            ตำแหน่ง {chart.totals.positions} · อัตรากำลัง {chart.totals.headcount} · นั่งอยู่{" "}
            {chart.totals.occupied} · ว่าง {chart.totals.vacancy} · ยังไม่จัดตำแหน่ง{" "}
            {chart.totals.unplaced}
          </p>
          {chart.roots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              สาขานี้ยังไม่มีตำแหน่ง —{" "}
              <Link
                href={`/hr/org?branchId=${branchId}&view=dept`}
                className="text-blue-700 hover:underline dark:text-blue-300"
              >
                ดูมุมมองแผนกแทน
              </Link>
            </p>
          )}
          <OrgChart chart={chart} search={search} />
          <UnplacedPersonnel chart={chart} />
        </>
      )}

      {deptView && (
        <>
          <p className="text-sm text-muted-foreground">
            คน {deptView.totals.personnel} · แผนก {deptView.totals.departments} · ยังไม่จัดแผนก{" "}
            {deptView.totals.unassigned}
          </p>
          <PersonnelOrgView view={deptView} />
        </>
      )}
    </div>
  )
}
