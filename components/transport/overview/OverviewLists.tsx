import Link from "next/link"
import { dataPanelClassName } from "@/components/shell/data-panel"
import type { TransportJobPriority, TransportRepairStatus } from "@prisma/client"
import { RepairStatusBadge } from "@/components/transport/repairs/RepairStatusBadge"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"

const PRIORITY_LABEL: Record<TransportJobPriority, string> = {
  low: "ต่ำ",
  normal: "ปกติ",
  high: "สูง",
  urgent: "ด่วน",
}

type PendingJob = {
  id: string
  jobNumber: string
  customerName: string | null
  priority: TransportJobPriority
  scheduledDate: Date | null
}

type OpenRepair = {
  id: string
  symptom: string
  status: TransportRepairStatus
  vehicle: { plateNumber: string; name: string }
}

export function OverviewLists({
  pendingJobs,
  openRepairs,
}: {
  pendingJobs: PendingJob[]
  openRepairs: OpenRepair[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={dataPanelClassName}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-border">
          <h2 className="text-sm font-semibold text-foreground">รอมอบหมาย</h2>
          <Link href="/transport/jobs" className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">
            ดูทั้งหมด →
          </Link>
        </div>
        {pendingJobs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground">ไม่มีใบงานรอมอบหมาย</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-border">
            {pendingJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/transport/jobs/${job.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-cyan-700 dark:text-cyan-300">{job.jobNumber}</p>
                    <p className="truncate text-sm text-foreground">
                      {job.customerName ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-foreground">
                    <p>{PRIORITY_LABEL[job.priority] ?? job.priority}</p>
                    {job.scheduledDate ? <p className="mt-0.5">{formatBangkokYmd(job.scheduledDate)}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={dataPanelClassName}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-border">
          <h2 className="text-sm font-semibold text-foreground">ซ่อมเปิด</h2>
          <Link href="/transport/repairs" className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">
            ดูทั้งหมด →
          </Link>
        </div>
        {openRepairs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground">ไม่มีรายการซ่อมเปิด</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-border">
            {openRepairs.map((repair) => (
              <li key={repair.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {repair.vehicle.plateNumber}
                  </p>
                  <p className="truncate text-sm text-foreground">{repair.symptom}</p>
                </div>
                <RepairStatusBadge status={repair.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
