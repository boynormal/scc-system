import Link from "next/link"
import { DataPanel } from "@/components/shell/data-panel"
import type { TransportJobStatus } from "@prisma/client"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"

type RecentJob = {
  id: string
  jobNumber: string
  customerName: string | null
  status: TransportJobStatus
  scheduledDate: Date | null
  assignment: {
    vehicle: { plateNumber: string }
    driver: { firstName: string; lastName: string }
  } | null
  _count: { stops: number }
}

export function OverviewRecentJobs({ jobs }: { jobs: RecentJob[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ใบงานล่าสุด</h2>
        <Link href="/transport/jobs" className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">
          ดูทั้งหมด →
        </Link>
      </div>
      <DataPanel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-xs font-medium uppercase tracking-wider text-foreground">
              <tr>
                <th className="px-4 py-3 text-left">เลขใบงาน</th>
                <th className="px-4 py-3 text-left">ลูกค้า</th>
                <th className="px-4 py-3 text-left">รถ / คนขับ</th>
                <th className="px-4 py-3 text-left">นัดวิ่ง</th>
                <th className="px-4 py-3 text-left">จุดแวะ</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-border">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-foreground">
                    ยังไม่มีใบงาน
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/transport/jobs/${job.id}`} className="text-cyan-700 hover:underline dark:text-cyan-300">
                        {job.jobNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{job.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">
                      {job.assignment ? (
                        <span>
                          {job.assignment.vehicle.plateNumber} / {job.assignment.driver.firstName}{" "}
                          {job.assignment.driver.lastName}
                        </span>
                      ) : (
                        <span className="text-foreground">ยังไม่มอบหมาย</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {job.scheduledDate ? formatBangkokYmd(job.scheduledDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{job._count.stops} จุด</td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </section>
  )
}
