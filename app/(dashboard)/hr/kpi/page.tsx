import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance, canReadHrPersonnel } from "@/lib/hr-settings-nav-access"
import { canReadPersonnel, countActivePersonnelByBranch, listAttendanceBranches } from "@/modules/hr"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"
import { listPersonnelJobGroups } from "@/modules/hr"
import { todayInZone } from "../attendance/attendance-format"
import { HrKpiView } from "./hr-kpi-view"
import { KPI_TABS, type KpiTab } from "./kpi-tabs"

export default async function HrKpiPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  const canPeople = canReadHrPersonnel(roles)
  const canAttendance = canReadHrAttendance(roles)
  if (!canPeople && !canAttendance) redirect("/")

  const searchParams = await props.searchParams
  const allowed = KPI_TABS.filter((tab) => (tab === "attendance" ? canAttendance : canPeople))
  const tab: KpiTab = allowed.includes(searchParams.tab as KpiTab) ? (searchParams.tab as KpiTab) : allowed[0]!

  const companyId = session.user.companyId as string
  const [branches, jobGroups] = await Promise.all([
    canAttendance ? listAttendanceBranches(prisma, { companyId, roles }) : Promise.resolve([]),
    canPeople ? listPersonnelJobGroups(prisma, { companyId, roles }).then((result) => result.data) : Promise.resolve([]),
  ])
  const sorted = [...branches].sort((a, b) => compareBranchTabName(a.name, b.name))
  const counts = canReadPersonnel(roles)
    ? await countActivePersonnelByBranch(prisma, {
        companyId,
        roles,
        branchIds: sorted.map((branch) => branch.id),
      })
    : undefined

  return (
    <HrKpiView
      branches={sorted}
      counts={counts}
      departments={jobGroups.map((group) => ({ id: group.id, name: group.name }))}
      today={todayInZone("Asia/Bangkok")}
      tabs={allowed}
      initialTab={tab}
    />
  )
}
