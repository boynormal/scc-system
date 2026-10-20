"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { dataPanelClassName } from "@/components/shell/data-panel"
import { ListFrame } from "@/components/shell/list-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { monthKeyOf, shiftMonthKey } from "@/modules/hr/application/attendance-day-calendar"
import { formatTime } from "../attendance/attendance-format"

type DayStatus = "COMPLETE" | "SINGLE_PUNCH" | "NO_SCAN"
type LeaveReason = "PERSONAL" | "SICK" | "ABSENT" | "INTRA_DAY"

type ExceptionRow = {
  personnelId: string
  displayName: string
  status: DayStatus
  late: boolean
  minutes: number
  noteReason: LeaveReason | null
  note: string | null
  firstIn: string | null
  lastOut: string | null
}

type ExceptionGroup = {
  date: string
  minutes: number
  rows: ExceptionRow[]
}

type ReportData = {
  branch: { timezone: string }
  exceptions: ExceptionGroup[]
}

function clock(iso: string | null, timeZone: string, locale: string): string {
  if (!iso) return "00:00"
  return formatTime(iso, timeZone, locale)
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function lastDateOfMonth(month: string): string {
  const [year, monthNum] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year!, monthNum!, 0))
  return `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`
}

function monthBounds(month: string, today: string): { from: string; to: string } {
  const end = lastDateOfMonth(month)
  return { from: `${month}-01`, to: month === monthKeyOf(today) && today < end ? today : end }
}

function formatMonthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number)
  return new Date(Date.UTC(year!, (monthNum ?? 1) - 1, 1)).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatMonthChip(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number)
  return new Date(Date.UTC(year!, (monthNum ?? 1) - 1, 1)).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: "short",
    timeZone: "UTC",
  })
}

function MonthPicker({
  month,
  today,
  onChange,
}: {
  month: string
  today: string
  onChange: (month: string) => void
}) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const todayMonth = monthKeyOf(today)
  const todayYear = Number(today.slice(0, 4))

  useEffect(() => {
    if (!open) return
    setYear(Number(month.slice(0, 4)))
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open, month])

  return (
    <div ref={rootRef} className="relative">
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("day.prevMonth")}
          icon={<ChevronLeft className="h-4 w-4" />}
          className="h-9 w-9 gap-0 border-slate-300 bg-white px-0 text-foreground shadow-sm hover:bg-muted dark:border-white/30 dark:bg-slate-950"
          onClick={() => onChange(shiftMonthKey(month, -1))}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          className="h-9 min-w-[9.5rem] border-slate-300 bg-white px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted dark:border-white/30 dark:bg-slate-950"
          onClick={() => setOpen((current) => !current)}
        >
          {formatMonthLabel(month, locale)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("day.nextMonth")}
          icon={<ChevronRight className="h-4 w-4" />}
          disabled={month >= todayMonth}
          className="h-9 w-9 gap-0 border-slate-300 bg-white px-0 text-foreground shadow-sm hover:bg-muted dark:border-white/30 dark:bg-slate-950"
          onClick={() => onChange(shiftMonthKey(month, 1))}
        />
      </div>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={t("exceptions.month")}
          className={cn(dataPanelClassName, "absolute left-0 top-full z-30 mt-1 w-[18rem] overflow-visible p-3")}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("day.prevMonth")}
              icon={<ChevronLeft className="h-4 w-4" />}
              className="h-8 w-8 gap-0 px-0 text-foreground"
              onClick={() => setYear((current) => current - 1)}
            />
            <span className="text-sm font-medium text-foreground">
              {new Date(Date.UTC(year, 0, 1)).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("day.nextMonth")}
              icon={<ChevronRight className="h-4 w-4" />}
              disabled={year >= todayYear}
              className="h-8 w-8 gap-0 px-0 text-foreground"
              onClick={() => setYear((current) => Math.min(current + 1, todayYear))}
            />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const key = `${year}-${pad(index + 1)}`
              const future = key > todayMonth
              const selected = key === month
              return (
                <button
                  key={key}
                  type="button"
                  disabled={future}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm font-medium text-foreground",
                    selected && "bg-blue-600 text-white",
                    !selected && !future && "hover:bg-muted",
                    future && "cursor-not-allowed text-muted-foreground"
                  )}
                >
                  {formatMonthChip(key, locale)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function AttendanceExceptionView({
  branches,
  departments,
  initialBranchId,
  today,
}: {
  branches: { id: string; code: string; name: string }[]
  departments: { id: string; name: string }[]
  initialBranchId: string
  today: string
}) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const [branchId, setBranchId] = useState(initialBranchId)
  const [month, setMonth] = useState(() => monthKeyOf(today))
  const { from, to } = monthBounds(month, today)
  const [departmentId, setDepartmentId] = useState("")
  const [groups, setGroups] = useState<ExceptionGroup[] | null>(null)
  const [timeZone, setTimeZone] = useState("Asia/Bangkok")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ branchId, from, to })
    if (departmentId) params.set("departmentId", departmentId)
    try {
      const res = await fetchJson<{ data: ReportData }>(`/api/hr/attendance/reports?${params}`)
      setGroups(res.data.exceptions ?? [])
      setTimeZone(res.data.branch.timezone || "Asia/Bangkok")
    } catch (err: unknown) {
      setGroups(null)
      setError(err instanceof Error ? err.message : t("loading"))
    } finally {
      setLoading(false)
    }
  }, [branchId, departmentId, from, t, to])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ListFrame
      filterOverflow
      filters={
        <>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">{t("exceptions.month")}</span>
            <MonthPicker month={month} today={today} onChange={setMonth} />
          </div>
          <Select
            label={t("branch")}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-64"
            options={branches.map((branch) => ({ value: branch.id, label: `${branch.code} ${branch.name}` }))}
          />
          <Select
            label={t("report.department")}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-52"
            placeholder={t("report.allDepartments")}
            options={departments.map((department) => ({ value: department.id, label: department.name }))}
          />
        </>
      }
    >
      {loading ? (
        <LoadingState title={t("loading")} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => void load()} />
      ) : !groups || groups.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={t("exceptions.emptyTitle")} description={t("exceptions.emptyDescription")} />
      ) : (
        <div className="max-h-[calc(100vh-11rem)] overflow-auto">
          <table className="w-max text-xs">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-foreground">
                <th className="w-36 px-2 py-1 font-medium">{t("report.name")}</th>
                <th className="min-w-[36rem] px-2 py-1 font-medium">{t("exceptions.report")}</th>
                <th className="w-28 whitespace-nowrap px-2 py-1 font-medium">{t("exceptions.inOut")}</th>
                <th className="w-12 px-2 py-1 text-right font-medium">{t("exceptions.minutes")}</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.date}>
                <tr className="border-b border-blue-200 bg-blue-100 dark:border-blue-900 dark:bg-blue-950">
                  <td colSpan={3} className="px-2 py-0.5 font-semibold text-foreground">
                    <Link
                      className="text-foreground underline-offset-2 hover:underline"
                      href={`/hr/attendance?${new URLSearchParams({ branchId, tab: "day", date: group.date })}`}
                    >
                      {group.date}
                    </Link>
                  </td>
                  <td className={`px-2 py-0.5 text-right font-mono font-semibold tabular-nums ${group.minutes > 0 ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>
                    {group.minutes}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={`${group.date}-${row.personnelId}`} className={`border-b border-border ${rowTone(row)}`}>
                    <td className="w-36 px-2 py-0.5 font-medium text-foreground">{row.displayName}</td>
                    <td className="min-w-[36rem] px-2 py-0.5">
                      <ExceptionLabel row={row} label={(key) => t(key)} />
                    </td>
                    <td className={`w-28 whitespace-nowrap px-2 py-0.5 font-mono tabular-nums ${row.status === "NO_SCAN" ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>
                      {clock(row.firstIn, timeZone, locale)} / {clock(row.lastOut, timeZone, locale)}
                    </td>
                    <td className={`w-12 px-2 py-0.5 text-right font-mono font-semibold tabular-nums ${row.minutes > 0 ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>
                      {row.minutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </ListFrame>
  )
}

function rowTone(row: ExceptionRow): string {
  if (row.status === "NO_SCAN" || row.noteReason === "ABSENT") return "bg-red-50 dark:bg-red-950/40"
  if (row.late) return "bg-red-50/70 dark:bg-red-950/30"
  if (row.status === "SINGLE_PUNCH" || row.noteReason === "SICK") return "bg-amber-50 dark:bg-amber-950/40"
  if (row.noteReason === "PERSONAL" || row.noteReason === "INTRA_DAY") return "bg-blue-50 dark:bg-blue-950/30"
  return ""
}

function reasonVariant(reason: LeaveReason): "danger" | "warning" | "info" {
  if (reason === "ABSENT") return "danger"
  if (reason === "SICK") return "warning"
  return "info"
}

function ExceptionLabel({
  row,
  label,
}: {
  row: ExceptionRow
  label: (key: "exceptions.late" | "exceptions.forgotScan" | "exceptions.noScan" | `report.reason.${LeaveReason}`) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {row.late ? <Badge variant="danger" className="px-1.5 py-0 text-[11px] leading-4">{label("exceptions.late")}</Badge> : null}
      {row.status === "SINGLE_PUNCH" ? <Badge variant="warning" className="px-1.5 py-0 text-[11px] leading-4">{label("exceptions.forgotScan")}</Badge> : null}
      {row.status === "NO_SCAN" ? <Badge variant="danger" className="px-1.5 py-0 text-[11px] leading-4">{label("exceptions.noScan")}</Badge> : null}
      {row.noteReason ? <Badge variant={reasonVariant(row.noteReason)} className="px-1.5 py-0 text-[11px] leading-4">{label(`report.reason.${row.noteReason}`)}</Badge> : null}
      {row.note ? <span className="min-w-0 flex-1 break-words text-xs text-foreground">{row.note}</span> : null}
    </div>
  )
}
