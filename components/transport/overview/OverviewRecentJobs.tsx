import Link from "next/link"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
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
      <AppDataTablePanel>
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th>เลขใบงาน</th>
                <th>ลูกค้า</th>
                <th>รถ / คนขับ</th>
                <th>นัดวิ่ง</th>
                <th>จุดแวะ</th>
                <th>สถานะ</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    ยังไม่มีใบงาน
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/transport/jobs/${job.id}`} className="text-cyan-700 hover:underline dark:text-cyan-300">
                        {job.jobNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{job.customerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {job.assignment ? (
                        <span>
                          {job.assignment.vehicle.plateNumber} / {job.assignment.driver.firstName}{" "}
                          {job.assignment.driver.lastName}
                        </span>
                      ) : (
                        <span>ยังไม่มอบหมาย</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job.scheduledDate ? formatBangkokYmd(job.scheduledDate) : "—"}
                    </td>
                    <td className="px-4 py-3">{job._count.stops} จุด</td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                  </tr>
                ))
              )}
            </AppDataTableBody>
          </AppDataTable>
      </AppDataTablePanel>
    </section>
  )
}
