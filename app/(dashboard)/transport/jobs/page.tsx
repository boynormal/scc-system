import { auth } from "@/lib/auth"

import { redirect } from "next/navigation"

import { prisma } from "@/shared/db"

import type { UserRole } from "@/lib/permissions"

import { countJobsByGroup, listJobs } from "@/modules/transport"

import { JobsListTable } from "@/components/transport/jobs-list-table"

import {

  JOB_LIST_GROUPS,

  resolveJobListGroup,

  type JobListGroup,

} from "@/shared/transport/job-status-groups"

import Link from "next/link"

import type { TransportJobPriority } from "@prisma/client"

import { Plus } from "lucide-react"



export const metadata = { title: "ใบงานขนส่ง" }



function buildJobsQuery(params: {

  group: JobListGroup

  page?: number

  branchId?: string | null

  priority?: TransportJobPriority | null

  search?: string | null

}) {

  const q = new URLSearchParams()

  q.set("group", params.group)

  if (params.page && params.page > 1) q.set("page", String(params.page))

  if (params.branchId) q.set("branchId", params.branchId)

  if (params.priority) q.set("priority", params.priority)

  if (params.search) q.set("search", params.search)

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



  const sp = await searchParams

  const group = resolveJobListGroup(sp.group)

  const branchId = sp.branchId ?? null

  const priority = (sp.priority as TransportJobPriority) ?? null

  const search = sp.search ?? null

  const page = Number(sp.page ?? "1")



  const roles = session.user.roles as UserRole[]

  const companyId = session.user.companyId as string



  const listParams = {

    companyId,

    roles,

    branchId,

    priority,

    search,

  }



  const [result, groupCounts] = await Promise.all([

    listJobs(prisma, {

      ...listParams,

      statusGroup: group,

      page,

      pageSize: 20,

    }),

    countJobsByGroup(prisma, listParams),

  ])



  const activeGroup = JOB_LIST_GROUPS.find((g) => g.id === group)!



  return (

    <div className="space-y-6 p-4 md:p-6">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-xl font-semibold text-slate-900">ใบงานขนส่ง</h1>

          <p className="text-sm text-slate-500">

            {activeGroup.label} {result.total} รายการ

          </p>

        </div>

        <Link

          href="/transport/jobs/new"

          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-700"

        >

          <Plus className="h-4 w-4" />

          สร้างใบงาน

        </Link>

      </div>



      <div className="flex flex-wrap gap-x-1 overflow-x-auto border-b border-slate-200 -mb-px">

        {JOB_LIST_GROUPS.map((tab) => {

          const isActive = tab.id === group

          const count = groupCounts[tab.id]

          return (

            <Link

              key={tab.id}

              href={buildJobsQuery({ group: tab.id, branchId, priority, search })}

              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${

                isActive

                  ? "border-cyan-600 text-cyan-700"

                  : "border-transparent text-slate-500 hover:text-slate-700"

              }`}

            >

              {tab.label}

              <span

                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${

                  isActive ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-600"

                }`}

              >

                {count}

              </span>

            </Link>

          )

        })}

      </div>



      <JobsListTable items={result.items} />



      {result.total > 20 && (

        <div className="flex items-center justify-between text-sm text-slate-600">

          <span>

            หน้า {result.page} จาก {Math.ceil(result.total / result.pageSize)}

          </span>

          <div className="flex gap-2">

            {result.page > 1 && (

              <Link

                href={buildJobsQuery({

                  group,

                  page: result.page - 1,

                  branchId,

                  priority,

                  search,

                })}

                className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"

              >

                ก่อนหน้า

              </Link>

            )}

            {result.page * result.pageSize < result.total && (

              <Link

                href={buildJobsQuery({

                  group,

                  page: result.page + 1,

                  branchId,

                  priority,

                  search,

                })}

                className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"

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

