import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listDriverMonitor } from "@/modules/transport"
import { canTransportJobs } from "@/modules/transport/application/transport-job-access"
import { ListFrame } from "@/components/shell/list-frame"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { currentFinanceMonth, financeMonthRange } from "@/components/finance/finance-month"
import { DriverReportMonth } from "@/components/transport/driver-report-month"
import { DriverReportTable } from "@/components/transport/driver-report-table"

const MONTH = /^\d{4}-\d{2}$/
const YMD = /^\d{4}-\d{2}-\d{2}$/

function resolveMonth(month?: string, from?: string) {
  if (month && MONTH.test(month)) return month
  if (from && YMD.test(from)) return from.slice(0, 7)
  return currentFinanceMonth()
}

export async function generateMetadata() {
  const t = await getTranslations("transport")
  return { title: t("reportsTitle") }
}

export default async function TransportDriverReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canTransportJobs(roles, "read")) redirect("/")

  const sp = await searchParams
  const month = resolveMonth(sp.month, sp.from)
  const range = financeMonthRange(month)
  const branchId = sp.branchId?.trim() || null
  const t = await getTranslations("transport")
  let report: Awaited<ReturnType<typeof listDriverMonitor>>
  try {
    report = await listDriverMonitor(prisma, {
      companyId: session.user.companyId as string,
      roles,
      branchId,
      from: range.dateFrom,
      to: range.dateTo,
    })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect(`/transport/reports?month=${month}`)
    }
    throw error
  }

  return (
    <div className="min-w-0 p-4 md:p-6">
      <ListFrame
        title={t("reportsTitle")}
        description={t("reportsDesc")}
        plainPanel
        filterOverflow
        filters={
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Select
              name="branchId"
              label={t("reportsBranch")}
              defaultValue={branchId ?? ""}
              placeholder={t("reportsAllBranches")}
              options={report.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              className="min-w-40"
            />
            <DriverReportMonth key={month} month={month} label={t("reportsRange")} />
            <Button type="submit" size="sm">
              {t("reportsShow")}
            </Button>
          </form>
        }
      >
        <DriverReportTable key={`${month}-${branchId ?? ""}`} rows={report.rows} />
      </ListFrame>
    </div>
  )
}
