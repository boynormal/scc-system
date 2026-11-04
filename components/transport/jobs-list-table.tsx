import Link from "next/link"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { Badge } from "@/components/ui/badge"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { JobRowActions } from "@/components/transport/job-row-actions"
import { jobCheckReview, type JobCheckReview } from "@/modules/transport/application/job-punch-rules"
import type { listJobs } from "@/modules/transport"

const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน" }
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-foreground",
  normal: "text-foreground",
  high: "text-amber-600 font-semibold",
  urgent: "text-red-600 font-bold",
}

type JobListItem = Awaited<ReturnType<typeof listJobs>>["items"][number]

function JobCheckReviewLink({
  jobId,
  stops,
  punches,
}: {
  jobId: string
  stops: JobListItem["stops"]
  punches: JobListItem["punches"]
}) {
  const review = jobCheckReview(stops, punches)
  return (
    <Link href={`/transport/jobs/${jobId}/log`}>
      <Badge variant={REVIEW_VARIANT[review]}>{REVIEW_LABEL[review]}</Badge>
    </Link>
  )
}

type Props = {
  items: JobListItem[]
}

function formatScheduledDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("th-TH", { dateStyle: "medium" })
}

const REVIEW_LABEL: Record<JobCheckReview, string> = {
  incomplete: "เช็คอินไม่ครบ",
  missing_location: "ไม่ครบสถานที่",
  complete: "เช็คอินครบ",
}

const REVIEW_VARIANT: Record<JobCheckReview, "info" | "warning" | "success"> = {
  incomplete: "info",
  missing_location: "warning",
  complete: "success",
}

export function JobsListTable({ items }: Props) {
  return (
    <AppDataTablePanel>
      <AppDataTable>
        <AppDataTableHead>
          <tr>
            <th className="px-4 py-3 text-left">เลขใบงาน</th>
            <th className="px-4 py-3 text-left">รถ / คนขับ</th>
            <th className="px-4 py-3 text-left">ลูกค้า / ประเภทงาน</th>
            <th className="px-4 py-3 text-left">ประเภทสินค้า</th>
            <th className="px-4 py-3 text-left">วันที่นัดวิ่งงาน</th>
            <th className="px-4 py-3 text-left">สาขา</th>
            <th className="px-4 py-3 text-left">Stop</th>
            <th className="px-4 py-3 text-left">ความสำคัญ</th>
            <th className="px-4 py-3 text-left">การตรวจสอบ</th>
            <th className="px-4 py-3 text-left">สถานะ</th>
            <th className="px-4 py-3 text-right">จัดการ</th>
          </tr>
        </AppDataTableHead>
        <AppDataTableBody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-10 text-center text-foreground">
                ไม่พบใบงาน
              </td>
            </tr>
          ) : (
            items.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/transport/jobs/${job.id}`}
                    className="font-medium text-cyan-700 hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {job.assignment ? (
                    <div>
                      <div>{job.assignment.vehicle.plateNumber}</div>
                      <div className="text-xs text-foreground">
                        {job.assignment.driver.firstName} {job.assignment.driver.lastName}
                      </div>
                    </div>
                  ) : (
                    <span className="text-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {job.customerName ?? job.customer?.name ?? "—"}
                  </div>
                  <div className="text-xs text-foreground">{job.jobType}</div>
                </td>
                <td className="px-4 py-3 text-foreground">{job.cargoType ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-foreground">
                  {formatScheduledDate(job.scheduledDate)}
                </td>
                <td className="px-4 py-3 text-foreground">{job.branch.name}</td>
                <td className="px-4 py-3 text-foreground">{job._count.stops}</td>
                <td className={`px-4 py-3 text-xs ${PRIORITY_COLOR[job.priority] ?? ""}`}>
                  {PRIORITY_LABEL[job.priority] ?? job.priority}
                </td>
                <td className="px-4 py-3">
                  <JobCheckReviewLink jobId={job.id} stops={job.stops} punches={job.punches} />
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
        </AppDataTableBody>
      </AppDataTable>
    </AppDataTablePanel>
  )
}
