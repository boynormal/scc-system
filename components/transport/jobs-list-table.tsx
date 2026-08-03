import Link from "next/link"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { JobRowActions } from "@/components/transport/job-row-actions"
import type { listJobs } from "@/modules/transport"

const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน" }
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-600 font-semibold",
  urgent: "text-red-600 font-bold",
}

type JobListItem = Awaited<ReturnType<typeof listJobs>>["items"][number]

type Props = {
  items: JobListItem[]
}

function formatScheduledDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("th-TH", { dateStyle: "medium" })
}

export function JobsListTable({ items }: Props) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">เลขใบงาน</th>
            <th className="px-4 py-3 text-left">รถ / คนขับ</th>
            <th className="px-4 py-3 text-left">ลูกค้า / ประเภทงาน</th>
            <th className="px-4 py-3 text-left">ประเภทสินค้า</th>
            <th className="px-4 py-3 text-left">วันที่นัดวิ่งงาน</th>
            <th className="px-4 py-3 text-left">สาขา</th>
            <th className="px-4 py-3 text-left">Stop</th>
            <th className="px-4 py-3 text-left">ความสำคัญ</th>
            <th className="px-4 py-3 text-left">สถานะ</th>
            <th className="px-4 py-3 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                ไม่พบใบงาน
              </td>
            </tr>
          ) : (
            items.map((job) => (
              <tr key={job.id} className="hover:bg-muted/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/transport/jobs/${job.id}`}
                    className="font-medium text-cyan-700 hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {job.assignment ? (
                    <div>
                      <div>{job.assignment.vehicle.plateNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {job.assignment.driver.firstName} {job.assignment.driver.lastName}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {job.customerName ?? job.customer?.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{job.jobType}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{job.cargoType ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatScheduledDate(job.scheduledDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{job.branch.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{job._count.stops}</td>
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
    </div>
  )
}
