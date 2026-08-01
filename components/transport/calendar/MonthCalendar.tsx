"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { CalendarJob } from "@/app/api/transport/calendar/route"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"
import { JobPopover, PRIORITY_CONFIG } from "./JobPopover"

type Props = {
  year: number
  month: number    // 0-indexed
  jobs: CalendarJob[]
}

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
const MAX_VISIBLE_JOBS = 6 // 2 rows × 3 chips

export function MonthCalendar({ year, month, jobs }: Props) {
  const [selectedJob, setSelectedJob] = useState<{
    job: CalendarJob
    cellKey: string
    anchorRect: DOMRect
  } | null>(null)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun

  // Build grid cells (may include prev/next month padding days)
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const weekRows = totalCells / 7
  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return new Date(year, month, dayNum)
  })

  const todayYmd = formatBangkokYmd()

  const jobsOnDay = (day: Date) => {
    const dayYmd = formatBangkokYmd(day)
    return jobs.filter((j) => formatBangkokYmd(new Date(j.scheduledDate)) === dayYmd)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Day headers */}
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-1 text-center text-xs font-semibold",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — equal-height rows fill remaining space */}
      <div
        className="grid min-h-0 flex-1 grid-cols-7 divide-x divide-y divide-border"
        style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
      >
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="min-h-[72px] bg-muted/50" />
          }

          const dayJobs = jobsOnDay(day)
          const dayYmd = formatBangkokYmd(day)
          const isToday = dayYmd === todayYmd
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const cellKey = dayYmd
          const plate = (job: CalendarJob) => job.vehicle?.plateNumber ?? "ไม่ระบุรถ"

          return (
            <div
              key={cellKey}
              className={cn(
                "relative flex min-h-[72px] flex-col p-0.5",
                isWeekend && "bg-muted/40"
              )}
            >
              {/* Day number */}
              <div className="mb-0.5 flex shrink-0 justify-end">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                    isToday ? "bg-cyan-600 text-white" : isWeekend ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Job chips — 3 per row */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-0.5">
                  {dayJobs.slice(0, MAX_VISIBLE_JOBS).map((job) => {
                    const p = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal
                    const isSelected = selectedJob?.job.id === job.id && selectedJob?.cellKey === cellKey
                    return (
                      <button
                        key={job.id}
                        type="button"
                        title={`${plate(job)} · ${job.jobNumber}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isSelected) {
                            setSelectedJob(null)
                            return
                          }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                          setSelectedJob({ job, cellKey, anchorRect: rect })
                        }}
                        className={cn(
                          "min-w-0 w-full rounded px-1 py-0.5 text-left text-[9px] font-medium truncate transition-opacity",
                          p.bg, p.text,
                          "hover:opacity-90"
                        )}
                      >
                        {plate(job)}
                      </button>
                    )
                  })}
                </div>
                {dayJobs.length > MAX_VISIBLE_JOBS && (
                  <p className="col-span-3 px-0.5 pt-0.5 text-[9px] text-muted-foreground">
                    +{dayJobs.length - MAX_VISIBLE_JOBS} อีก
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedJob && (
        <JobPopover
          job={selectedJob.job}
          anchorRect={selectedJob.anchorRect}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  )
}
