import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listDriverMonitor } from "@/modules/transport"
import { canTransportJobs } from "@/modules/transport/application/transport-job-access"
import { getBangkokLastNDaysRange } from "@/modules/transport/application/transport-date-utils"
import { ListFrame } from "@/components/shell/list-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { DriverReportTable } from "@/components/transport/driver-report-table"

const YMD = /^\d{4}-\d{2}-\d{2}$/

function resolveRange(from?: string, to?: string) {
  const fallback = getBangkokLastNDaysRange(30)
  const start = from && YMD.test(from) ? from : fallback.from
  const end = to && YMD.test(to) ? to : fallback.to
  if (start > end) return fallback
  return { from: start, to: end }
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
  const range = resolveRange(sp.from, sp.to)
  const branchId = sp.branchId?.trim() || null
  const t = await getTranslations("transport")
  let report: Awaited<ReturnType<typeof listDriverMonitor>>
  try {
    report = await listDriverMonitor(prisma, {
      companyId: session.user.companyId as string,
      roles,
      branchId,
      from: range.from,
      to: range.to,
    })
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect(`/transport/reports?from=${range.from}&to=${range.to}`)
    }
    throw error
  }

  return (
    <div className="min-w-0 p-4 md:p-6">
      <ListFrame
        title={t("reportsTitle")}
        description={t("reportsDesc")}
        plainPanel
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
            <Input name="from" type="date" label={t("reportsFrom")} defaultValue={range.from} />
            <Input name="to" type="date" label={t("reportsTo")} defaultValue={range.to} />
            <Button type="submit" size="sm">
              {t("reportsShow")}
            </Button>
          </form>
        }
      >
        <DriverReportTable key={`${range.from}-${range.to}-${branchId ?? ""}`} rows={report.rows} />
      </ListFrame>
    </div>
  )
}
