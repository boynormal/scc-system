"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { ListFrame } from "@/components/shell/list-frame"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { monthKeyOf } from "@/modules/hr/application/attendance-day-calendar"
import { AttendanceDayPicker } from "../attendance/attendance-day-picker"
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
  const [date, setDate] = useState(today)
  const { from, to } = monthBounds(monthKeyOf(date), today)
  const selectedRef = useRef<HTMLTableRowElement>(null)
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

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" })
  }, [date, groups])

  return (
    <ListFrame
      title={t("exceptions.title")}
      description={t("exceptions.description")}
      filterOverflow
      filters={
        <>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">{t("day.date")}</span>
            <AttendanceDayPicker branchId={branchId} date={date} today={today} onChange={setDate} />
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
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">{t("report.name")}</th>
                <th className="py-2 pr-3 font-medium">{t("exceptions.report")}</th>
                <th className="py-2 pr-3 font-medium">{t("exceptions.inOut")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("exceptions.minutes")}</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.date}>
                <tr ref={group.date === date ? selectedRef : undefined} className={group.date === date ? "border-b border-border bg-blue-50 dark:bg-blue-950/40" : "border-b border-border bg-muted/40"}>
                  <td colSpan={3} className="py-2 pr-3 font-medium">
                    <Link
                      className="text-foreground underline-offset-2 hover:underline"
                      href={`/hr/attendance?${new URLSearchParams({ branchId, tab: "day", date: group.date })}`}
                    >
                      {group.date}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{group.minutes}</td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={`${group.date}-${row.personnelId}`} className="border-b border-border">
                    <td className="py-2 pr-3">{row.displayName}</td>
                    <td className="py-2 pr-3">
                      <ExceptionLabel row={row} label={(key) => t(key)} />
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      {clock(row.firstIn, timeZone, locale)} / {clock(row.lastOut, timeZone, locale)}
                    </td>
                    <td className={`py-2 pr-3 text-right font-mono tabular-nums ${row.late ? "text-red-600" : ""}`}>{row.minutes}</td>
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

function ExceptionLabel({
  row,
  label,
}: {
  row: ExceptionRow
  label: (key: "exceptions.late" | "exceptions.forgotScan" | "exceptions.noScan" | `report.reason.${LeaveReason}`) => string
}) {
  const parts: { text: string; late?: boolean }[] = []
  if (row.late) parts.push({ text: label("exceptions.late"), late: true })
  if (row.status === "SINGLE_PUNCH") parts.push({ text: label("exceptions.forgotScan") })
  if (row.status === "NO_SCAN") parts.push({ text: label("exceptions.noScan") })
  if (row.noteReason) parts.push({ text: label(`report.reason.${row.noteReason}`) })
  return (
    <span className="text-foreground">
      {parts.map((part, index) => (
        <span key={part.text} className={part.late ? "font-medium text-red-600" : undefined}>
          {index > 0 ? " " : ""}
          {part.text}
        </span>
      ))}
      {row.note ? <span>{parts.length > 0 ? " " : ""}{row.note}</span> : null}
    </span>
  )
}
