import Link from "next/link"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { JobRowActions } from "@/components/transport/job-row-actions"
import type { listJobs } from "@/modules/transport"

const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน" }
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-slate-500",
  normal: "text-slate-700",
  high: "text-amber-600 font-semibold",
  urgent: "text-red-600 font-bold",
}

type JobListItem = Awaited<ReturnType<typeof listJobs>>["items"][number]

type Props = {
  items: JobListItem[]
}

export function JobsListTable({ items }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">เลขใบงาน</th>
            <th className="px-4 py-3 text-left">ลูกค้า / ประเภทงาน</th>
            <th className="px-4 py-3 text-left">สาขา</th>
            <th className="px-4 py-3 text-left">รถ / คนขับ</th>
            <th className="px-4 py-3 text-left">Stop</th>
            <th className="px-4 py-3 text-left">ความสำคัญ</th>
            <th className="px-4 py-3 text-left">สถานะ</th>
            <th className="px-4 py-3 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                ไม่พบใบงาน
              </td>
            </tr>
          ) : (
            items.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/transport/jobs/${job.id}`}
                    className="font-medium text-cyan-700 hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">
                    {job.customerName ?? job.customer?.name ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500">{job.jobType}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{job.branch.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {job.assignment ? (
                    <div>
                      <div>{job.assignment.vehicle.plateNumber}</div>
                      <div className="text-xs text-slate-500">
                        {job.assignment.driver.firstName} {job.assignment.driver.lastName}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{job._count.stops}</td>
                <td className={`px-4 py-3 text-xs ${PRIORITY_COLOR[job.priority] ?? ""}`}>
                  {PRIORITY_LABEL[job.priority] ?? job.priority}
                </td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3">
                  <JobRowActions jobId={job.id} jobStatus={job.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
