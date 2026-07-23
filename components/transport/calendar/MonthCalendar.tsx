"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { CalendarJob } from "@/app/api/transport/calendar/route"
import { JobPopover, PRIORITY_CONFIG } from "./JobPopover"

type Props = {
  year: number
  month: number    // 0-indexed
  jobs: CalendarJob[]
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

export function MonthCalendar({ year, month, jobs }: Props) {
  const [selectedJob, setSelectedJob] = useState<{ job: CalendarJob; cellKey: string } | null>(null)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun

  // Build grid cells (may include prev/next month padding days)
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return new Date(year, month, dayNum)
  })

  const today = new Date()

  const jobsOnDay = (day: Date) =>
    jobs.filter((j) => isSameDay(new Date(j.scheduledDate), day))

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-2 text-center text-xs font-semibold",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="min-h-[90px] bg-slate-50/50" />
          }

          const dayJobs = jobsOnDay(day)
          const isToday = isSameDay(day, today)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const cellKey = day.toISOString()

          return (
            <div key={cellKey} className={cn("relative min-h-[90px] p-1", isWeekend && "bg-slate-50/40")}>
              {/* Day number */}
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-cyan-600 text-white" : isWeekend ? "text-slate-400" : "text-slate-700"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Job bars */}
              <div className="space-y-0.5">
                {dayJobs.slice(0, 3).map((job) => {
                  const p = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal
                  const isSelected = selectedJob?.job.id === job.id && selectedJob?.cellKey === cellKey
                  return (
                    <div key={job.id} className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedJob(isSelected ? null : { job, cellKey })
                        }}
                        className={cn(
                          "w-full rounded px-1.5 py-0.5 text-left text-[10px] font-medium truncate transition-opacity",
                          p.bg, p.text,
                          "hover:opacity-90"
                        )}
                      >
                        {job.vehicle?.plateNumber ?? "ไม่ระบุรถ"} · {job.jobNumber}
                      </button>
                      {isSelected && (
                        <JobPopover job={job} onClose={() => setSelectedJob(null)} />
                      )}
                    </div>
                  )
                })}
                {dayJobs.length > 3 && (
                  <p className="px-1 text-[10px] text-slate-400">+{dayJobs.length - 3} อีก</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
