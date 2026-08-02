import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { isAdminInAnyBranch, getBranchIds } from "@/lib/permissions"
import { getTransportOverview } from "@/modules/transport"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"
import { OverviewAttention } from "@/components/transport/overview/OverviewAttention"
import { OverviewKpiRow } from "@/components/transport/overview/OverviewKpiRow"
import { OverviewLists } from "@/components/transport/overview/OverviewLists"
import { OverviewRecentJobs } from "@/components/transport/overview/OverviewRecentJobs"
import { getTranslations } from "next-intl/server"

export async function generateMetadata() {
  const t = await getTranslations("transport")
  return { title: t("overviewTitle") }
}

export default async function TransportDashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const branchIds = isAdminInAnyBranch(roles)
    ? (await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } })).map((b) => b.id)
    : getBranchIds(roles)

  const overview = await getTransportOverview(prisma, { companyId, branchIds })
  const todayLabel = formatBangkokYmd()

  return (
    <div className="min-w-0 space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-foreground">ภาพรวมขนส่ง</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-muted-foreground">
            สรุปปฏิบัติการวันนี้ ({todayLabel}) — ฟลีทร่วมทั้งบริษัท · งาน/ซ่อมตามสาขาที่เข้าถึง
          </p>
        </div>
      </div>

      <OverviewAttention
        pendingAssignment={overview.attention.pendingAssignment}
        scheduledToday={overview.attention.scheduledToday}
        openRepairs={overview.attention.openRepairs}
        vehiclesMaintenance={overview.attention.vehiclesMaintenance}
      />

      <OverviewKpiRow fleet={overview.fleet} today={overview.today} />

      <OverviewLists pendingJobs={overview.pendingJobs} openRepairs={overview.openRepairs} />

      <OverviewRecentJobs jobs={overview.recentJobs} />
    </div>
  )
}
