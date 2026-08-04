import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { countJobsByGroup, listJobs } from "@/modules/transport"
import { getBangkokLastNDaysRange } from "@/modules/transport/application/transport-date-utils"
import { JobsListTable } from "@/components/transport/jobs-list-table"
import { JobsListFilters } from "@/components/transport/jobs-list-filters"
import { JobsListSearch } from "@/components/transport/jobs-list-search"
import {
  JOB_LIST_GROUPS,
  resolveJobListGroup,
  type JobListGroup,
} from "@/shared/transport/job-status-groups"
import Link from "next/link"
import type { TransportJobPriority } from "@prisma/client"
import { getTranslations } from "next-intl/server"
import { CreateJobButton } from "@/components/transport/CreateJobButton"
import { TransportSegmentedTabs } from "@/components/transport/toolbar"
import { Suspense } from "react"

export async function generateMetadata() {
  const t = await getTranslations("transport")
  return { title: t("jobsTitle") }
}

const TERMINAL_GROUPS = new Set<JobListGroup>(["completed", "cancelled"])

function buildJobsQuery(params: {
  group: JobListGroup
  page?: number
  branchId?: string | null
  priority?: TransportJobPriority | null
  search?: string | null
  from?: string | null
  to?: string | null
}) {
  const q = new URLSearchParams()
  q.set("group", params.group)
  if (params.page && params.page > 1) q.set("page", String(params.page))
  if (params.branchId) q.set("branchId", params.branchId)
  if (params.priority) q.set("priority", params.priority)
  if (params.search) q.set("search", params.search)
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  const s = q.toString()
  return s ? `?${s}` : ""
}

export default async function TransportJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("transport")

  const sp = await searchParams
  const group = resolveJobListGroup(sp.group)
  const branchId = sp.branchId ?? null
  const priority = (sp.priority as TransportJobPriority) ?? null
  const search = sp.search ?? null
  const page = Number(sp.page ?? "1")
  const urlFrom = sp.from?.trim() || ""
  const urlTo = sp.to?.trim() || ""

  const defaultRange = getBangkokLastNDaysRange(30)
  const isTerminal = TERMINAL_GROUPS.has(group)
  const effectiveFrom = isTerminal ? urlFrom || defaultRange.from : urlFrom
  const effectiveTo = isTerminal ? urlTo || defaultRange.to : urlTo

  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  const listParams = {
    companyId,
    roles,
    branchId,
    priority,
    search,
  }

  const dateForList = isTerminal
    ? { from: effectiveFrom || null, to: effectiveTo || null }
    : { from: null, to: null }

  const dateForCounts = {
    from: urlFrom || defaultRange.from,
    to: urlTo || defaultRange.to,
  }

  const queryBase = {
    branchId,
    priority,
    search,
    from: urlFrom || null,
    to: urlTo || null,
  }

  const [result, groupCounts] = await Promise.all([
    listJobs(prisma, {
      ...listParams,
      ...dateForList,
      statusGroup: group,
      page,
      pageSize: 20,
    }),
    countJobsByGroup(prisma, {
      ...listParams,
      ...dateForCounts,
    }),
  ])

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <TransportSegmentedTabs
            activeKey={group}
            items={JOB_LIST_GROUPS.map((tab) => ({
              key: tab.id,
              label: tab.label,
              count: groupCounts[tab.id],
              href: buildJobsQuery({ group: tab.id, ...queryBase }),
            }))}
          />

          <Suspense fallback={null}>
            <JobsListSearch />
          </Suspense>

          <Suspense fallback={null}>
            <JobsListFilters
              group={group}
              effectiveFrom={isTerminal ? effectiveFrom : urlFrom}
              effectiveTo={isTerminal ? effectiveTo : urlTo}
              defaultFrom={defaultRange.from}
              defaultTo={defaultRange.to}
            />
          </Suspense>
        </div>

        <CreateJobButton label={t("jobsNew")} />
      </div>

      {isTerminal && (
        <p className="text-xs text-muted-foreground">
          แสดงช่วง {effectiveFrom} – {effectiveTo} (ตามวันที่อัปเดตล่าสุด)
        </p>
      )}

      <JobsListTable items={result.items} />

      {result.total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            หน้า {result.page} จาก {Math.ceil(result.total / result.pageSize)}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={buildJobsQuery({
                  group,
                  page: result.page - 1,
                  ...queryBase,
                })}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted/60"
              >
                ก่อนหน้า
              </Link>
            )}
            {result.page * result.pageSize < result.total && (
              <Link
                href={buildJobsQuery({
                  group,
                  page: result.page + 1,
                  ...queryBase,
                })}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted/60"
              >
                ถัดไป
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
