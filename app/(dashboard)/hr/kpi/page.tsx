import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance, canReadHrPersonnel } from "@/lib/hr-settings-nav-access"
import { listAttendanceBranches } from "@/modules/hr"
import { listDepartments } from "@/modules/settings"
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
  const [branches, departments] = await Promise.all([
    canAttendance ? listAttendanceBranches(prisma, { companyId, roles }) : Promise.resolve([]),
    listDepartments(prisma, { companyId }),
  ])

  return (
    <HrKpiView
      branches={branches}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      today={todayInZone("Asia/Bangkok")}
      tabs={allowed}
      initialTab={tab}
    />
  )
}
