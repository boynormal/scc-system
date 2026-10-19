import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { FileSpreadsheet } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance } from "@/lib/hr-settings-nav-access"
import { listAttendanceBranches } from "@/modules/hr"
import { listDepartments } from "@/modules/settings"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { todayInZone } from "../attendance/attendance-format"
import { AttendanceReportView } from "./attendance-report-view"

export default async function HrReportsPage() {
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
        <EmptyState icon={FileSpreadsheet} title={t("noBranchTitle")} description={t("noBranchDescription")} />
      </GlassCard>
    )
  }

  const today = todayInZone("Asia/Bangkok")
  return (
    <AttendanceReportView
      branches={branches}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      initialBranchId={branches[0]!.id}
      initialFrom={`${today.slice(0, 8)}01`}
      initialTo={today}
    />
  )
}
