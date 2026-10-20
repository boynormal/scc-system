"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { FileSpreadsheet } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { ListFrame } from "@/components/shell/list-frame"
import { GlassDialog } from "@/components/glass"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { monthKeyOf } from "@/modules/hr/application/attendance-day-calendar"
import { monthBounds } from "@/modules/hr/application/hr-kpi"
import { formatMinutes } from "../attendance/attendance-format"
import { MonthPicker } from "../exceptions/attendance-exception-view"

type LeaveCounts = { PERSONAL: number; SICK: number; ABSENT: number; INTRA_DAY: number }
type DayStatus = "COMPLETE" | "SINGLE_PUNCH" | "NO_SCAN"
type FilterKey = "pending" | "single" | "none"

type DayRow = {
  date: string
  present: number
  manMinutes: number
  confirmedOtMinutes: number
  pendingOtCount: number
  singlePunch: number
  noScan: number
  leave: LeaveCounts
}

type PersonDay = {
  date: string
  status: DayStatus
  manMinutes: number
  lateMinutes: number
  otBeforeMinutes: number
  otAfterMinutes: number
  noteReason: string | null
}

type PersonRow = {
  personnelId: string
  displayName: string
  departmentName: string | null
  presentDays: number
  manMinutes: number
  lateMinutes: number
  otBeforeMinutes: number
  otAfterMinutes: number
  pendingOtCount: number
  singlePunch: number
  noScan: number
  leave: LeaveCounts
  days: PersonDay[]
}

type ReportData = {
  cards: {
    presentPeople: number
    manMinutes: number
    confirmedOtMinutes: number
    pendingOtCount: number
    leave: LeaveCounts
  }
  days: DayRow[]
  people: PersonRow[]
}

const REASONS = ["PERSONAL", "SICK", "ABSENT", "INTRA_DAY"] as const

function leaveText(leave: LeaveCounts, label: (reason: (typeof REASONS)[number]) => string): string {
  const parts = REASONS.filter((reason) => leave[reason] > 0).map((reason) => `${label(reason)} ${leave[reason]}`)
  return parts.join(", ")
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\n")
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AttendanceReportView({
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
  const [branchId, setBranchId] = useState(initialBranchId)
  const [month, setMonth] = useState(() => monthKeyOf(today))
  const bounds = monthBounds(month, today)
  const from = bounds?.start ?? `${month}-01`
  const to = bounds?.asOf ?? from
  const [departmentId, setDepartmentId] = useState("")
  const [view, setView] = useState<"day" | "person">("day")
  const [filter, setFilter] = useState<FilterKey | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState<PersonRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ branchId, from, to })
    if (departmentId) params.set("departmentId", departmentId)
    try {
      const res = await fetchJson<{ data: ReportData }>(`/api/hr/attendance/reports?${params}`)
      setReport(res.data)
    } catch (err: unknown) {
      setReport(null)
      setError(err instanceof Error ? err.message : t("loading"))
    } finally {
      setLoading(false)
    }
  }, [branchId, departmentId, from, t, to])

  useEffect(() => {
    void load()
  }, [load])

  const reasonLabel = useCallback((reason: (typeof REASONS)[number]) => t(`report.reason.${reason}`), [t])

  const days = useMemo(() => {
    if (!report) return []
    if (filter === "pending") return report.days.filter((day) => day.pendingOtCount > 0)
    if (filter === "single") return report.days.filter((day) => day.singlePunch > 0)
    if (filter === "none") return report.days.filter((day) => day.noScan > 0)
    return report.days
  }, [filter, report])

  const people = useMemo(() => {
    if (!report) return []
    if (filter === "pending") return report.people.filter((row) => row.pendingOtCount > 0)
    if (filter === "single") return report.people.filter((row) => row.singlePunch > 0)
    if (filter === "none") return report.people.filter((row) => row.noScan > 0)
    return report.people
  }, [filter, report])

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? null : next))
  }

  function exportTable() {
    if (!report) return
    const reasonHeaders = REASONS.map((reason) => t(`report.reason.${reason}`))
    if (view === "day") {
      downloadCsv(`attendance-${from}-${to}-days.csv`, [
        [t("day.date"), t("report.present"), t("report.manHour"), t("report.confirmedOt"), t("report.pendingOt"), t("report.singlePunch"), t("report.noScan"), ...reasonHeaders],
        ...days.map((day) => [
          day.date,
          String(day.present),
          formatMinutes(day.manMinutes),
          formatMinutes(day.confirmedOtMinutes),
          String(day.pendingOtCount),
          String(day.singlePunch),
          String(day.noScan),
          ...REASONS.map((reason) => String(day.leave[reason])),
        ]),
      ])
      return
    }
    downloadCsv(`attendance-${from}-${to}-people.csv`, [
      [t("report.name"), t("report.department"), t("report.presentDays"), t("report.manHour"), t("report.late"), t("report.otBefore"), t("report.otAfter"), ...reasonHeaders],
      ...people.map((row) => [
        row.displayName,
        row.departmentName ?? "",
        String(row.presentDays),
        formatMinutes(row.manMinutes),
        String(row.lateMinutes),
        formatMinutes(row.otBeforeMinutes),
        formatMinutes(row.otAfterMinutes),
        ...REASONS.map((reason) => String(row.leave[reason])),
      ]),
    ])
  }

  const singleTotal = report?.days.reduce((sum, day) => sum + day.singlePunch, 0) ?? 0
  const noScanTotal = report?.days.reduce((sum, day) => sum + day.noScan, 0) ?? 0
  const pending = report?.cards.pendingOtCount ?? 0

  return (
    <>
      <ListFrame
        title={t("report.title")}
        description={t("report.description")}
        filterOverflow
        actions={
          <Button size="sm" variant="outline" disabled={!report || loading} onClick={exportTable}>
            {t("report.export")}
          </Button>
        }
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
        ) : !report ? (
          <EmptyState icon={FileSpreadsheet} title={t("report.emptyTitle")} description={t("report.emptyDescription")} />
        ) : (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label={t("report.presentPeople")} value={String(report.cards.presentPeople)} />
              <SummaryCard label={t("report.manHour")} value={formatMinutes(report.cards.manMinutes)} />
              <SummaryCard label={t("report.confirmedOt")} value={formatMinutes(report.cards.confirmedOtMinutes)} />
              <button type="button" onClick={() => toggleFilter("pending")} className="rounded-lg border border-border bg-background p-3 text-left">
                <div className={`font-mono text-2xl font-semibold tabular-nums ${pending > 0 ? "text-red-600" : "text-foreground"}`}>
                  {pending}
                </div>
                <div className="mt-1 text-sm text-foreground">{t("report.pendingOt")}</div>
              </button>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-sm font-medium text-foreground">{t("report.leave")}</div>
                <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                  {REASONS.map((reason) => (
                    <li key={reason} className="flex justify-between gap-3">
                      <span>{t(`report.reason.${reason}`)}</span>
                      <span className="font-mono tabular-nums">{report.cards.leave[reason]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
              <FilterChip active={filter === "pending"} onClick={() => toggleFilter("pending")}>
                {t("report.pendingOt")} {pending}
              </FilterChip>
              <FilterChip active={filter === "single"} onClick={() => toggleFilter("single")}>
                {t("report.singlePunch")} {singleTotal}
              </FilterChip>
              <FilterChip active={filter === "none"} onClick={() => toggleFilter("none")}>
                {t("report.noScan")} {noScanTotal}
              </FilterChip>
              <span className="mx-1 text-foreground">·</span>
              <Button size="sm" variant={view === "day" ? "primary" : "outline"} onClick={() => setView("day")}>
                {t("report.byDay")}
              </Button>
              <Button size="sm" variant={view === "person" ? "primary" : "outline"} onClick={() => setView("person")}>
                {t("report.byPerson")}
              </Button>
            </div>

            {view === "day" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-medium">{t("day.date")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.present")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.manHour")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.confirmedOt")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.pendingOt")}</th>
                      <th className="py-2 pr-3 font-medium">{t("report.leave")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day.date} className="border-b border-border">
                        <td className="py-2 pr-3">
                          <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={`/hr/attendance?${new URLSearchParams({ branchId, tab: "day", date: day.date })}`}>
                            {day.date}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{day.present}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(day.manMinutes)}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(day.confirmedOtMinutes)}</td>
                        <td className={`py-2 pr-3 text-right font-mono tabular-nums ${day.pendingOtCount > 0 ? "text-red-600" : ""}`}>{day.pendingOtCount}</td>
                        <td className="py-2 pr-3">{leaveText(day.leave, reasonLabel) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : people.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title={t("report.emptyTitle")} description={t("report.emptyDescription")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-medium">{t("report.name")}</th>
                      <th className="py-2 pr-3 font-medium">{t("report.department")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.presentDays")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.manHour")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.late")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.otBefore")}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t("report.otAfter")}</th>
                      <th className="py-2 pr-3 font-medium">{t("report.leave")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((row) => (
                      <tr key={row.personnelId} className="border-b border-border">
                        <td className="py-2 pr-3">
                          <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => setPerson(row)}>
                            {row.displayName}
                          </button>
                        </td>
                        <td className="py-2 pr-3">{row.departmentName ?? "—"}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.presentDays}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(row.manMinutes)}</td>
                        <td className={`py-2 pr-3 text-right font-mono tabular-nums ${row.lateMinutes > 0 ? "text-red-600" : ""}`}>{row.lateMinutes || "—"}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(row.otBeforeMinutes)}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(row.otAfterMinutes)}</td>
                        <td className="py-2 pr-3">{leaveText(row.leave, reasonLabel) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ListFrame>

      <GlassDialog open={person != null} onOpenChange={(open) => !open && setPerson(null)} title={person ? t("report.personDays", { name: person.displayName }) : ""} solid>
        {person && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-foreground">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium">{t("day.date")}</th>
                  <th className="py-2 pr-3 font-medium">{t("day.status")}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t("report.manHour")}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t("report.otBefore")}</th>
                  <th className="py-2 pr-3 font-medium text-right">{t("report.otAfter")}</th>
                  <th className="py-2 pr-3 font-medium">{t("report.leave")}</th>
                </tr>
              </thead>
              <tbody>
                {person.days.map((day) => (
                  <tr key={day.date} className="border-b border-border">
                    <td className="py-2 pr-3">{day.date}</td>
                    <td className="py-2 pr-3">{t(`status.${day.status}`)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(day.manMinutes)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(day.otBeforeMinutes)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMinutes(day.otAfterMinutes)}</td>
                    <td className="py-2 pr-3">{day.noteReason ? t(`report.reason.${day.noteReason as (typeof REASONS)[number]}`) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassDialog>
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-sm text-foreground">{label}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-foreground ${active ? "border-foreground bg-background font-medium" : "border-border bg-background"}`}
    >
      {children}
    </button>
  )
}
