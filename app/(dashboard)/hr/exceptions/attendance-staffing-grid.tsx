"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { isSunday } from "@/modules/hr/application/attendance-off-days"
import type { DepartmentFilterMode } from "@/modules/hr/application/attendance-report"

export type StaffingCell = {
  date: string
  departmentId: string | null
  jobGroupId: string | null
  total: number
  fullLeave: number
  intraLeave: number
  intraLostMinutes?: number
  late: number
  lateMinutes?: number
  manMinutes: number
  lostMinutes: number
}

type Day = {
  total: number
  fullLeave: number
  intraLeave: number
  intraLostMinutes: number
  late: number
  lateMinutes: number
  manMinutes: number
  lostMinutes: number
}

function lastDay(month: string): number {
  const [year, monthNum] = month.split("-").map(Number)
  return new Date(Date.UTC(year!, monthNum!, 0)).getUTCDate()
}

function included(departmentId: string | null, mode: DepartmentFilterMode, selected: ReadonlySet<string | null>): boolean {
  if (selected.size === 0) return true
  return selected.has(departmentId) === (mode === "only")
}

/** ชั่วโมงที่เหลือหลังหักเวลาที่หายไป เทียบกับเพดานคนทั้งหมด × 8 ชม. */
function remainPct(day: { total: number; fullLeave: number; lateMinutes: number; intraLostMinutes: number }): number {
  const capacity = day.total * 8 * 60
  if (capacity <= 0) return 0
  const used = day.fullLeave * 8 * 60 + day.intraLostMinutes + day.lateMinutes
  return (Math.max(0, capacity - used) / capacity) * 100
}

function formatPct(value: number): string {
  return value.toFixed(1)
}

function formatHours(minutes: number): string {
  const hours = minutes / 60
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

type Cell = { text: string; alert?: boolean }

function dateKey(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`
}

const stickyCell = "sticky left-0 z-10 whitespace-nowrap border border-slate-300 px-2 py-1 text-left font-medium"
const labelCell = `${stickyCell} bg-white text-foreground`
const dayCell = "border border-slate-300 px-1 py-1 text-center tabular-nums text-foreground"
const totalCell = "whitespace-nowrap border border-slate-300 px-2 py-1 text-left font-semibold text-foreground"

export function StaffingGrids({
  month,
  today,
  cells,
  mode,
  selected,
  offDates = [],
  holidayDates = [],
  place = "",
}: {
  month: string
  today: string
  cells: StaffingCell[]
  mode: DepartmentFilterMode
  selected: ReadonlySet<string | null>
  offDates?: string[]
  holidayDates?: string[]
  place?: string
}) {
  const t = useTranslations("attendance")
  const count = lastDay(month)
  const days = useMemo(() => {
    const byDay = new Map<number, Day>()
    for (const cell of cells) {
      if (!cell.date.startsWith(month) || cell.date > today) continue
      if (!included(cell.jobGroupId, mode, selected)) continue
      const day = Number(cell.date.slice(8, 10))
      const current = byDay.get(day) ?? { total: 0, fullLeave: 0, intraLeave: 0, intraLostMinutes: 0, late: 0, lateMinutes: 0, manMinutes: 0, lostMinutes: 0 }
      current.total += cell.total
      current.fullLeave += cell.fullLeave
      current.intraLeave += cell.intraLeave
      current.intraLostMinutes += cell.intraLostMinutes ?? 0
      current.late += cell.late
      current.lateMinutes += cell.lateMinutes ?? 0
      current.manMinutes += cell.manMinutes
      current.lostMinutes += cell.lostMinutes
      byDay.set(day, current)
    }
    return Array.from({ length: count }, (_, index) => {
      const day = byDay.get(index + 1)
      return day && day.total > 0 ? day : null
    })
  }, [cells, count, mode, month, selected, today])

  const off = useMemo(() => new Set(offDates), [offDates])
  const working = days.flatMap((day, index) => {
    if (!day) return []
    const date = `${month}-${String(index + 1).padStart(2, "0")}`
    return off.has(date) ? [] : [day]
  })
  const filled = days.filter((day): day is Day => day != null)
  const sum = (pick: (day: Day) => number) => filled.reduce((total, day) => total + pick(day), 0)
  const average = (pick: (day: Day) => number, alert = false): Cell => {
    if (working.length === 0) return { text: t("exceptions.staffingAvg", { value: "—" }) }
    const value = working.reduce((total, day) => total + pick(day), 0) / working.length
    return { text: t("exceptions.staffingAvg", { value: value.toFixed(1) }), alert: alert && value > 0 }
  }
  const totalFull = sum((day) => day.fullLeave)
  const avgRemain = working.length ? working.reduce((total, day) => total + remainPct(day), 0) / working.length : 0

  const numbers = (pick: (day: Day) => number, alert = false): Cell[] =>
    days.map((day) => {
      if (!day) return { text: "" }
      const value = pick(day)
      return { text: String(value), alert: alert && value > 0 }
    })
  const percents = (pick: (day: Day) => number, alert = false): Cell[] =>
    days.map((day) => {
      if (!day) return { text: "" }
      const value = pick(day)
      return { text: formatPct(value), alert: alert && value > 0 }
    })
  const summary = (text: string, alert = false): Cell => ({ text, alert })
  const titled = (title: string) => (place ? `${title} (${place})` : title)
  const hours = (pick: (day: Day) => number, alert = false): Cell[] =>
    days.map((day) => {
      if (!day) return { text: "" }
      const minutes = pick(day)
      return { text: formatHours(minutes), alert: alert && minutes > 0 }
    })

  return (
    <div className="w-full min-w-0 space-y-4">
      <Grid
        title={titled(t("exceptions.staffingTitle"))}
        titleClass="bg-blue-600 text-white"
        dayClass="bg-blue-100 font-semibold text-blue-950"
        itemLabel={t("exceptions.staffingItem")}
        count={count}
        month={month}
        holidayDates={holidayDates}
        showTotal
        totalHeader="AVG"
        rows={[
          [t("exceptions.staffingTotalPeople"), numbers((day) => day.total), average((day) => day.total)],
          [t("exceptions.staffingFullLeave"), numbers((day) => day.fullLeave, true), average((day) => day.fullLeave, true)],
          [t("exceptions.staffingIntraLeave"), numbers((day) => day.intraLeave, true), average((day) => day.intraLeave, true)],
          [t("exceptions.staffingLate"), numbers((day) => day.late, true), average((day) => day.late, true)],
          [
            t("exceptions.staffingRemainPeople"),
            numbers((day) => day.total - day.fullLeave),
            average((day) => day.total - day.fullLeave),
          ],
        ]}
      />
      <Grid
        title={titled(t("exceptions.manHourTitle"))}
        titleClass="bg-green-600 text-white"
        dayClass="bg-green-100 font-semibold text-green-950"
        itemLabel={t("exceptions.staffingItem")}
        count={count}
        month={month}
        holidayDates={holidayDates}
        showTotal
        rows={[
          [
            t("exceptions.manHourHours"),
            numbers((day) => day.total * 8),
            summary(t("exceptions.staffingSum", { value: sum((day) => day.total * 8) })),
          ],
          [
            t("exceptions.manHourFullPct"),
            hours((day) => day.fullLeave * 480, true),
            summary(t("exceptions.staffingSum", { value: formatHours(sum((day) => day.fullLeave * 480)) }), totalFull > 0),
          ],
          [
            t("exceptions.manHourIntraPct"),
            hours((day) => day.intraLostMinutes, true),
            summary(t("exceptions.staffingSum", { value: formatHours(sum((day) => day.intraLostMinutes)) }), sum((day) => day.intraLostMinutes) > 0),
          ],
          [
            t("exceptions.manHourLost"),
            numbers((day) => day.lateMinutes, true),
            summary(t("exceptions.staffingSum", { value: sum((day) => day.lateMinutes) }), sum((day) => day.lateMinutes) > 0),
          ],
          [
            t("exceptions.manHourRemainPct"),
            percents((day) => remainPct(day)),
            summary(t("exceptions.staffingAvg", { value: formatPct(avgRemain) })),
          ],
        ]}
      />
    </div>
  )
}

function Grid({
  title,
  titleClass,
  dayClass,
  itemLabel,
  count,
  month,
  holidayDates,
  rows,
  showTotal = false,
  totalHeader = "TOTAL",
}: {
  title: string
  titleClass: string
  dayClass: string
  itemLabel: string
  count: number
  month: string
  holidayDates: string[]
  rows: Array<[string, Cell[], Cell]>
  showTotal?: boolean
  totalHeader?: string
}) {
  const holidays = useMemo(() => new Set(holidayDates), [holidayDates])
  const days = Array.from({ length: count }, (_, index) => index + 1)
  const tone = (day: number) => {
    const date = dateKey(month, day)
    if (isSunday(date)) return "bg-amber-100 text-amber-950"
    if (holidays.has(date)) return "bg-blue-100 text-blue-950"
    return ""
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0 text-[11px]">
        <colgroup>
          <col className="w-36" />
          {days.map((day) => (
            <col key={day} />
          ))}
          {showTotal ? <col className="w-28" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th className={labelCell} />
            <th colSpan={count + (showTotal ? 1 : 0)} className={`border border-slate-300 px-2 py-1 text-center text-sm font-semibold ${titleClass}`}>
              {title}
            </th>
          </tr>
          <tr>
            <th className={`${stickyCell} ${dayClass}`}>{itemLabel}</th>
            {days.map((day) => (
              <th key={day} className={cn("border border-slate-300 px-1 py-1 text-center", tone(day) || dayClass)}>
                {day}
              </th>
            ))}
            {showTotal ? <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-center font-semibold text-foreground">{totalHeader}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, values, total]) => (
            <tr key={label}>
              <th className={labelCell}>{label}</th>
              {values.map((value, index) => (
                <td key={index} className={cn(dayCell, tone(index + 1), value.alert && "!font-semibold !text-red-600")}>
                  {value.text}
                </td>
              ))}
              {showTotal ? <td className={cn(totalCell, total.alert && "!text-red-600")}>{total.text}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
