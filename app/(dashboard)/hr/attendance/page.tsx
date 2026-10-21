import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Clock } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canAttendanceAnyBranch, canManageAttendanceDevice, canReadPersonnel, countActivePersonnelByBranch, listAttendanceBranches } from "@/modules/hr"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { AttendanceChrome } from "./attendance-chrome"
import { AttendanceDayView } from "./attendance-day-view"
import { AttendanceBadgeView } from "./attendance-badge-view"
import { AttendanceDeviceView } from "./attendance-device-view"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"

export const metadata: Metadata = { title: "บันทึกเวลา" }

const TABS = ["day", "badges", "devices"] as const
type Tab = (typeof TABS)[number]

export default async function HrAttendancePage(props: {
  searchParams: Promise<{ branchId?: string; tab?: string; date?: string }>
}) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canAttendanceAnyBranch(roles, "read")) redirect("/")

  const t = await getTranslations("attendance")
  const companyId = session.user.companyId as string
  const branches = (await listAttendanceBranches(prisma, { companyId, roles })).sort((a, b) =>
    compareBranchTabName(a.name, b.name)
  )
  const branch = branches.find((b) => b.id === searchParams.branchId) ?? branches[0] ?? null
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "day"
  const counts = canReadPersonnel(roles)
    ? await countActivePersonnelByBranch(prisma, {
        companyId,
        roles,
        branchIds: branches.map((item) => item.id),
      })
    : {}

  const perms = {
    canUpdate: canAttendanceAnyBranch(roles, "update"),
  }

  return (
    <div className="space-y-3">
      {!branch ? (
        <GlassCard padding="none">
          <EmptyState icon={Clock} title={t("noBranchTitle")} description={t("noBranchDescription")} />
        </GlassCard>
      ) : (
        <>
          <AttendanceChrome branches={branches} branchId={branch.id} tab={tab} counts={counts} />

          {tab === "day" && (
            <AttendanceDayView
              key={branch.id}
              branchId={branch.id}
              initialDate={searchParams.date}
              canUpdate={perms.canUpdate}
            />
          )}
          {tab === "badges" && <AttendanceBadgeView key={branch.id} branchId={branch.id} canUpdate={perms.canUpdate} />}
          {tab === "devices" && (
            <AttendanceDeviceView
              key={branch.id}
              branch={branch}
              canManage={canManageAttendanceDevice(roles, branch.id)}
            />
          )}
        </>
      )}
    </div>
  )
}
