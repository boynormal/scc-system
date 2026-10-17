import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Clock } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canAttendanceAnyBranch, listAttendanceBranches } from "@/modules/hr"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { cn } from "@/lib/utils"
import { AttendanceDayView } from "./attendance-day-view"
import { AttendanceBadgeView } from "./attendance-badge-view"
import { AttendanceDeviceView } from "./attendance-device-view"

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
  const branches = await listAttendanceBranches(prisma, { companyId, roles })
  const branch = branches.find((b) => b.id === searchParams.branchId) ?? branches[0] ?? null
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "day"

  const perms = {
    canUpdate: canAttendanceAnyBranch(roles, "update"),
    canCreate: canAttendanceAnyBranch(roles, "create"),
  }

  const tabHref = (next: Tab) => `/hr/attendance?${new URLSearchParams({ ...(branch && { branchId: branch.id }), tab: next })}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      {!branch ? (
        <GlassCard padding="none">
          <EmptyState icon={Clock} title={t("noBranchTitle")} description={t("noBranchDescription")} />
        </GlassCard>
      ) : (
        <>
          <GlassCard padding="md">
            <form className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tab" value={tab} />
              <div className="min-w-[240px]">
                <label htmlFor="attendance-branch" className="block text-sm font-medium text-foreground">
                  {t("branch")}
                </label>
                <select
                  id="attendance-branch"
                  name="branchId"
                  defaultValue={branch.id}
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900">
                {t("useBranch")}
              </button>
            </form>
          </GlassCard>

          <nav className="flex gap-1 border-b border-border" aria-label={t("title")}>
            {TABS.map((key) => (
              <Link
                key={key}
                href={tabHref(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === key
                    ? "border-blue-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`tabs.${key}`)}
              </Link>
            ))}
          </nav>

          {tab === "day" && <AttendanceDayView key={branch.id} branchId={branch.id} initialDate={searchParams.date} />}
          {tab === "badges" && <AttendanceBadgeView key={branch.id} branchId={branch.id} canUpdate={perms.canUpdate} />}
          {tab === "devices" && (
            <AttendanceDeviceView
              key={branch.id}
              branch={branch}
              canCreate={perms.canCreate}
              canUpdate={perms.canUpdate}
            />
          )}
        </>
      )}
    </div>
  )
}
