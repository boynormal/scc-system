import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance } from "@/lib/hr-settings-nav-access"
import { canReadPersonnel, countActivePersonnelByBranch, listAttendanceBranches } from "@/modules/hr"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"
import { listDepartments } from "@/modules/settings"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { todayInZone } from "../attendance/attendance-format"
import { AttendanceExceptionView } from "./attendance-exception-view"

export default async function HrExceptionsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canReadHrAttendance(roles)) redirect("/")

  const companyId = session.user.companyId as string
  const [branches, departments] = await Promise.all([
    listAttendanceBranches(prisma, { companyId, roles }),
    listDepartments(prisma, { companyId }),
  ])
  const t = await getTranslations("attendance")
  if (branches.length === 0) {
    return (
      <GlassCard padding="none">
        <EmptyState icon={AlertTriangle} title={t("noBranchTitle")} description={t("noBranchDescription")} />
      </GlassCard>
    )
  }

  const sorted = [...branches].sort((a, b) => compareBranchTabName(a.name, b.name))
  const counts = canReadPersonnel(roles)
    ? await countActivePersonnelByBranch(prisma, {
        companyId,
        roles,
        branchIds: sorted.map((branch) => branch.id),
      })
    : undefined
  const today = todayInZone("Asia/Bangkok")
  return (
    <AttendanceExceptionView
      branches={sorted}
      counts={counts}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      initialBranchId={sorted[0]!.id}
      today={today}
    />
  )
}
