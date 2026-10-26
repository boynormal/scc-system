"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import {
  BarChart3,
  Briefcase,
  CalendarOff,
  Clock,
  Cake,
  ShieldCheck,
  Timer,
  TrendingDown,
  UserMinus,
  UserPlus,
  Users,
  AlarmClock,
  UserX,
  type LucideIcon,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { ListFrame } from "@/components/shell/list-frame"
import { SubTabs } from "@/components/shell/sub-tabs"
import { SLIDING_PILL_BASE, SLIDING_PILL_MOTION, useSlidingPill } from "@/components/shell/use-sliding-pill"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { monthKeyOf } from "@/modules/hr/application/attendance-day-calendar"
import { formatMinutes } from "../attendance/attendance-format"
import { MonthPicker } from "../exceptions/attendance-exception-view"
import { StaffingGrids, type StaffingCell } from "../exceptions/attendance-staffing-grid"
import type { KpiTab } from "./kpi-tabs"

type CountRow = { name: string; count: number }
type Workforce = {
  headcount: number
  byBranch: CountRow[]
  byDepartment: CountRow[]
  averageTenureYears: number | null
  averageAgeYears: number | null
  ageBands: { under30: number; age30: number; age40: number; age50: number; unknown: number }
  gender: { male: number; female: number; unspecified: number }
  nationality?: { thai: number; myanmar: number; other: number; unknown: number }
}
type Turnover = {
  hires: number
  leavers: number
  voluntaryLeavers: number
  turnoverRate: number | null
  voluntaryTurnoverRate: number | null
  retentionRate: number | null
}
type DailyRow = { date: string; present: number; noScan: number; singlePunch: number; leave: number }
type Attendance = {
  presentDays: number
  onTimeDays: number
  lateDays: number
  expectedDays: number
  absentDays: number
  leaveDays: number
  leaveHours: number
  manMinutes: number
  confirmedOtMinutes: number
  leave?: { PERSONAL: number; SICK: number; ABSENT: number; INTRA_DAY: number }
  daily?: DailyRow[]
}
type TrendPoint = { month: string; hires: number; leavers: number }
type KpiData = { workforce: Workforce | null; turnover: Turnover | null; trend: TrendPoint[]; attendance: Attendance | null }
type Slice = { name: string; value: number; color: string }

const BLUE = "#2563eb"
const SKY = "#0ea5e9"
const PINK = "#db2777"
const RED = "#dc2626"
const AMBER = "#d97706"
const GREEN = "#16a34a"
const VIOLET = "#7c3aed"
const SLATE = "#94a3b8"
const AGE_COLORS = ["#60a5fa", "#3b82f6", "#2563eb", "#1e40af", SLATE]

const TICK = { fill: "currentColor", fontSize: 12 }
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
}

type Tone = "blue" | "green" | "red" | "amber" | "violet" | "slate"
const TONES: Record<Tone, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
}

function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}

function years(value: number | null): string {
  return value == null ? "—" : value.toFixed(1)
}

function pct(value: number | null): string {
  return value == null ? "—" : `${value}%`
}

function hours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

function monthRange(month: string, today: string): { from: string; to: string } {
  const [year, monthNum] = month.split("-").map(Number)
  const end = new Date(Date.UTC(year!, monthNum!, 0)).getUTCDate()
  const last = `${month}-${String(end).padStart(2, "0")}`
  return { from: `${month}-01`, to: month === today.slice(0, 7) && today < last ? today : last }
}

export function HrKpiView({
  branches,
  counts,
  departments,
  today,
  tabs,
  initialTab,
}: {
  branches: { id: string; name: string }[]
  counts?: Record<string, number>
  departments: { id: string; name: string }[]
  today: string
  tabs: KpiTab[]
  initialTab: KpiTab
}) {
  const t = useTranslations("kpi")
  const locale = useLocale()
  const router = useRouter()
  const [tab, setTab] = useState<KpiTab>(initialTab)
  const [month, setMonth] = useState(() => monthKeyOf(today))
  const [branchId, setBranchId] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [data, setData] = useState<KpiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffing, setStaffing] = useState<StaffingCell[]>([])
  const [offDates, setOffDates] = useState<string[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [staffingLoading, setStaffingLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ month })
    if (branchId) params.set("branchId", branchId)
    if (departmentId) params.set("departmentId", departmentId)
    try {
      const res = await fetchJson<{ data: KpiData }>(`/api/hr/kpi?${params}`)
      setData(res.data)
    } catch (err: unknown) {
      setData(null)
      setError(err instanceof Error ? err.message : t("noAccess"))
    } finally {
      setLoading(false)
    }
  }, [branchId, departmentId, month, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (tab !== "workforce" || branches.length === 0) return
    let cancelled = false
    const ids = branchId ? [branchId] : branches.map((branch) => branch.id)
    const { from, to } = monthRange(month, today)
    setStaffingLoading(true)
    void Promise.all(
      ids.map((id) =>
        fetchJson<{ data: { staffing?: StaffingCell[]; offDates?: string[]; holidayDates?: string[] } }>(
          `/api/hr/attendance/reports?${new URLSearchParams({ branchId: id, from, to })}`
        )
      )
    )
      .then((results) => {
        if (cancelled) return
        setStaffing(results.flatMap((result) => result.data.staffing ?? []))
        const shared = (pick: (result: (typeof results)[number]) => string[]) => {
          const counts = new Map<string, number>()
          for (const result of results) {
            for (const date of pick(result)) counts.set(date, (counts.get(date) ?? 0) + 1)
          }
          return [...counts.entries()].filter(([, seen]) => seen === ids.length).map(([date]) => date)
        }
        setOffDates(shared((result) => result.data.offDates ?? []))
        setHolidayDates(shared((result) => result.data.holidayDates ?? []))
      })
      .catch(() => {
        if (!cancelled) {
          setStaffing([])
          setOffDates([])
          setHolidayDates([])
        }
      })
      .finally(() => {
        if (!cancelled) setStaffingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [branchId, branches, month, tab, today])

  const departmentSelection = useMemo(
    () => (departmentId ? new Set<string | null>([departmentId]) : new Set<string | null>()),
    [departmentId]
  )

  const workforce = data?.workforce
  const turnover = data?.turnover
  const attendance = data?.attendance
  const noData = t("noData")

  function selectTab(next: KpiTab) {
    setTab(next)
    router.replace(`/hr/kpi?${new URLSearchParams({ tab: next })}`, { scroll: false })
  }

  const { rootRef, setItemRef, shownKey, select, pillStyle, ready } = useSlidingPill(true, tab)

  const activeTotal = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined

  return (
    <div className="space-y-3">
      {branches.length > 1 && (
        <SubTabs
          aria-label={t("branch")}
          activeKey={branchId || "all"}
          onChange={(key) => setBranchId(key === "all" ? "" : key)}
          items={[
            { key: "all", label: t("allBranches"), ...(activeTotal != null ? { count: activeTotal } : {}) },
            ...branches.map((branch) => ({
              key: branch.id,
              label: branch.name,
              ...(counts ? { count: counts[branch.id] ?? 0 } : {}),
            })),
          ]}
        />
      )}
    <ListFrame
      title={t("title")}
      filterOverflow
      filters={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-medium text-foreground">{t("month")}</span>
          <MonthPicker month={month} today={today} onChange={setMonth} />
          <span className="text-sm font-medium text-foreground">{t("department")}</span>
          <Select
            aria-label={t("department")}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            placeholder={t("allDepartments")}
            className="w-52"
            options={departments.map((department) => ({ value: department.id, label: department.name }))}
          />
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <nav ref={rootRef} className="relative flex gap-1 border-b border-border" aria-label={t("title")}>
          {pillStyle && (
            <span aria-hidden className={cn(SLIDING_PILL_BASE, ready && SLIDING_PILL_MOTION)} style={pillStyle}>
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
            </span>
          )}
          {tabs.map((key) => {
            const active = key === shownKey
            return (
              <button
                key={key}
                ref={setItemRef(key)}
                type="button"
                onClick={() => {
                  select(key)
                  selectTab(key)
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 px-3 py-2 text-sm font-medium transition-colors duration-300",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`tabs.${key}`)}
              </button>
            )
          })}
        </nav>
        {loading ? (
          <LoadingState title="…" />
        ) : error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !(tab === "attendance" ? attendance : tab === "turnover" ? turnover : workforce) ? (
          <EmptyState icon={BarChart3} title={t("noAccess")} />
        ) : (
          <>
            {tab === "workforce" && workforce && (
              <section className="space-y-3">
                {branches.length > 0 ? (
                  staffingLoading ? (
                    <LoadingState title="…" />
                  ) : (
                    <StaffingGrids
                      month={month}
                      today={today}
                      cells={staffing}
                      offDates={offDates}
                      holidayDates={holidayDates}
                      mode="only"
                      selected={departmentSelection}
                    />
                  )
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <KpiCard
                    icon={Users}
                    tone="blue"
                    label={t("headcount")}
                    value={String(workforce.headcount)}
                    unit={t("people")}
                    hint={`${t("male")} ${workforce.gender.male} · ${t("female")} ${workforce.gender.female}`}
                  />
                  <KpiCard
                    icon={Briefcase}
                    tone="violet"
                    label={t("averageTenure")}
                    value={years(workforce.averageTenureYears)}
                    unit={t("yearsUnit")}
                    hint={t("excludesUnknown")}
                  />
                  <KpiCard
                    icon={Cake}
                    tone="amber"
                    label={t("averageAge")}
                    value={years(workforce.averageAgeYears)}
                    unit={t("yearsUnit")}
                    hint={t("excludesUnknown")}
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <ChartCard title={t("genderShare")} empty={workforce.headcount === 0} emptyText={noData}>
                    <Donut
                      total={workforce.headcount}
                      totalLabel={t("people")}
                      slices={[
                        { name: t("male"), value: workforce.gender.male, color: SKY },
                        { name: t("female"), value: workforce.gender.female, color: PINK },
                        { name: t("unknown"), value: workforce.gender.unspecified, color: SLATE },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title={t("nationalityShare")} empty={workforce.headcount === 0} emptyText={noData}>
                    <Donut
                      total={workforce.headcount}
                      totalLabel={t("people")}
                      slices={[
                        { name: t("thai"), value: workforce.nationality?.thai ?? 0, color: BLUE },
                        { name: t("myanmar"), value: workforce.nationality?.myanmar ?? 0, color: AMBER },
                        { name: t("otherNationality"), value: workforce.nationality?.other ?? 0, color: GREEN },
                        { name: t("unknown"), value: workforce.nationality?.unknown ?? workforce.headcount, color: SLATE },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard title={t("ageBands")} empty={workforce.headcount === 0} emptyText={noData}>
                    <ColumnBars
                      unit={t("people")}
                      rows={[
                        { name: t("under30"), count: workforce.ageBands.under30 },
                        { name: t("age30"), count: workforce.ageBands.age30 },
                        { name: t("age40"), count: workforce.ageBands.age40 },
                        { name: t("age50"), count: workforce.ageBands.age50 },
                        { name: t("unknown"), count: workforce.ageBands.unknown },
                      ]}
                      colors={AGE_COLORS}
                    />
                  </ChartCard>
                  <ChartCard
                    title={t("byBranch")}
                    empty={workforce.byBranch.length === 0}
                    emptyText={noData}
                    height={barHeight(workforce.byBranch.length)}
                  >
                    <RowBars rows={workforce.byBranch} color={BLUE} unit={t("people")} />
                  </ChartCard>
                  <div className="lg:col-span-2">
                    <ChartCard
                      title={t("byDepartment")}
                      empty={workforce.byDepartment.length === 0}
                      emptyText={noData}
                      height={barHeight(workforce.byDepartment.length)}
                    >
                      <RowBars rows={workforce.byDepartment} color={VIOLET} unit={t("people")} />
                    </ChartCard>
                  </div>
                </div>
              </section>
            )}

            {tab === "turnover" && turnover && (
              <section className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    icon={ShieldCheck}
                    tone="green"
                    label={t("retentionRate")}
                    value={pct(turnover.retentionRate)}
                    hint={t("retentionHint")}
                  />
                  <KpiCard
                    icon={TrendingDown}
                    tone="red"
                    label={t("turnoverRate")}
                    value={pct(turnover.turnoverRate)}
                    hint={t("turnoverHint")}
                  />
                  <KpiCard
                    icon={UserMinus}
                    tone="amber"
                    label={t("voluntaryRate")}
                    value={pct(turnover.voluntaryTurnoverRate)}
                    hint={t("voluntaryHint", { count: turnover.voluntaryLeavers, total: turnover.leavers })}
                  />
                  <KpiCard
                    icon={UserPlus}
                    tone="blue"
                    label={`${t("hires")} / ${t("leavers")}`}
                    value={`${turnover.hires} / ${turnover.leavers}`}
                    unit={t("people")}
                    hint={t("thisMonth")}
                  />
                </div>
                <ChartCard
                  title={t("trend")}
                  empty={(data?.trend ?? []).every((point) => point.hires === 0 && point.leavers === 0)}
                  emptyText={noData}
                >
                  <HireLeaveBars points={data?.trend ?? []} locale={locale} hires={t("hires")} leavers={t("leavers")} />
                </ChartCard>
              </section>
            )}

            {tab === "attendance" && attendance && (
              <section className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <KpiCard
                    icon={Clock}
                    tone="green"
                    label={t("onTimeRate")}
                    value={pct(ratio(attendance.onTimeDays, attendance.presentDays))}
                    hint={t("ofPresentDays", { count: attendance.onTimeDays, total: attendance.presentDays })}
                  />
                  <KpiCard
                    icon={AlarmClock}
                    tone="amber"
                    label={t("lateRate")}
                    value={pct(ratio(attendance.lateDays, attendance.presentDays))}
                    hint={t("ofPresentDays", { count: attendance.lateDays, total: attendance.presentDays })}
                  />
                  <KpiCard
                    icon={UserX}
                    tone="red"
                    label={t("absenceRate")}
                    value={pct(ratio(attendance.absentDays, attendance.expectedDays))}
                    hint={t("ofExpectedDays", { count: attendance.absentDays, total: attendance.expectedDays })}
                  />
                  <KpiCard
                    icon={CalendarOff}
                    tone="violet"
                    label={t("leaveDays")}
                    value={String(attendance.leaveDays)}
                    unit={t("daysUnit")}
                    hint={t("leaveHoursHint", { hours: attendance.leaveHours })}
                  />
                  <KpiCard
                    icon={Briefcase}
                    tone="blue"
                    label={t("manHour")}
                    value={formatMinutes(attendance.manMinutes)}
                    unit={t("hoursUnit")}
                  />
                  <KpiCard
                    icon={Timer}
                    tone="slate"
                    label={t("otHours")}
                    value={formatMinutes(attendance.confirmedOtMinutes)}
                    unit={t("hoursUnit")}
                    hint={t("otShare", {
                      percent: pct(ratio(attendance.confirmedOtMinutes, attendance.manMinutes)),
                    })}
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <ChartCard title={t("workStatus")} empty={attendance.expectedDays === 0} emptyText={noData}>
                    <Donut
                      total={attendance.expectedDays}
                      totalLabel={t("daysUnit")}
                      slices={[
                        { name: t("onTime"), value: attendance.onTimeDays, color: GREEN },
                        { name: t("late"), value: attendance.lateDays, color: AMBER },
                        { name: t("absent"), value: attendance.absentDays, color: RED },
                      ]}
                    />
                  </ChartCard>
                  <ChartCard
                    title={t("leaveByReason")}
                    empty={!attendance.leave || Object.values(attendance.leave).every((value) => value === 0)}
                    emptyText={noData}
                  >
                    <ColumnBars
                      unit={t("daysUnit")}
                      rows={[
                        { name: t("personal"), count: attendance.leave?.PERSONAL ?? 0 },
                        { name: t("sick"), count: attendance.leave?.SICK ?? 0 },
                        { name: t("intraDay"), count: attendance.leave?.INTRA_DAY ?? 0 },
                        { name: t("absentNote"), count: attendance.leave?.ABSENT ?? 0 },
                      ]}
                      colors={[VIOLET, AMBER, SKY, RED]}
                    />
                  </ChartCard>
                </div>
                <ChartCard
                  title={t("dailyPresence")}
                  empty={(attendance.daily ?? []).length === 0}
                  emptyText={noData}
                  height={260}
                >
                  <DailyBars
                    rows={attendance.daily ?? []}
                    labels={{
                      present: t("present"),
                      leave: t("leave"),
                      singlePunch: t("singlePunch"),
                      noScan: t("noScan"),
                    }}
                  />
                </ChartCard>
                <ChartCard
                  title={t("hoursCompare")}
                  empty={attendance.manMinutes === 0 && attendance.confirmedOtMinutes === 0}
                  emptyText={noData}
                  height={120}
                >
                  <HoursBar
                    regular={hours(attendance.manMinutes)}
                    ot={hours(attendance.confirmedOtMinutes)}
                    regularLabel={t("regular")}
                    otLabel={t("ot")}
                    unit={t("hoursUnit")}
                  />
                </ChartCard>
              </section>
            )}
          </>
        )}
      </div>
    </ListFrame>
    </div>
  )
}

function barHeight(count: number): number {
  return Math.max(224, count * 32 + 24)
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  hint,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: string
  unit?: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</span>
          {unit && value !== "—" && <span className="text-sm text-foreground">{unit}</span>}
        </div>
        {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  children,
  empty,
  emptyText,
  height = 224,
}: {
  title: string
  children: React.ReactNode
  empty?: boolean
  emptyText?: string
  height?: number
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {empty ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="text-foreground" style={{ height }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Donut({ slices, total, totalLabel }: { slices: Slice[]; total: number; totalLabel: string }) {
  const shown = slices.filter((slice) => slice.value > 0)
  const sum = shown.reduce((acc, slice) => acc + slice.value, 0)
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={shown.length > 1 ? 2 : 0}
              stroke="none"
            >
              {shown.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
        </div>
      </div>
      <ul className="w-40 shrink-0 space-y-2">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-sm text-foreground">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="font-mono tabular-nums">{slice.value}</span>
            <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {sum > 0 ? `${Math.round((slice.value / sum) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RowBars({ rows, color, unit }: { rows: CountRow[]; color: string; unit: string }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.4} />
        <XAxis type="number" allowDecimals={false} tick={TICK} />
        <YAxis type="category" dataKey="name" width={130} tick={TICK} interval={0} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fillOpacity: 0.08 }} formatter={(v: number) => [`${v} ${unit}`]} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList dataKey="count" position="right" fill="currentColor" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ColumnBars({ rows, colors, unit }: { rows: CountRow[]; colors: string[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
        <XAxis dataKey="name" tick={TICK} interval={0} />
        <YAxis allowDecimals={false} tick={TICK} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fillOpacity: 0.08 }} formatter={(v: number) => [`${v} ${unit}`]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {rows.map((row, index) => (
            <Cell key={row.name} fill={colors[index % colors.length]} />
          ))}
          <LabelList dataKey="count" position="top" fill="currentColor" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function HireLeaveBars({
  points,
  locale,
  hires,
  leavers,
}: {
  points: TrendPoint[]
  locale: string
  hires: string
  leavers: string
}) {
  const data = points.map((point) => ({
    ...point,
    label: new Date(`${point.month}-01T00:00:00.000Z`).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
        <XAxis dataKey="label" tick={TICK} />
        <YAxis allowDecimals={false} tick={TICK} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fillOpacity: 0.08 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="hires" name={hires} fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={32}>
          <LabelList dataKey="hires" position="top" fill="currentColor" fontSize={12} />
        </Bar>
        <Bar dataKey="leavers" name={leavers} fill={RED} radius={[4, 4, 0, 0]} maxBarSize={32}>
          <LabelList dataKey="leavers" position="top" fill="currentColor" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DailyBars({
  rows,
  labels,
}: {
  rows: DailyRow[]
  labels: { present: string; leave: string; singlePunch: string; noScan: string }
}) {
  const data = rows.map((row) => ({ ...row, day: Number(row.date.slice(8, 10)) }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
        <XAxis dataKey="day" tick={TICK} interval={0} />
        <YAxis allowDecimals={false} tick={TICK} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fillOpacity: 0.08 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="present" name={labels.present} stackId="day" fill={GREEN} />
        <Bar dataKey="singlePunch" name={labels.singlePunch} stackId="day" fill={AMBER} />
        <Bar dataKey="leave" name={labels.leave} stackId="day" fill={VIOLET} />
        <Bar dataKey="noScan" name={labels.noScan} stackId="day" fill={RED} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function HoursBar({
  regular,
  ot,
  regularLabel,
  otLabel,
  unit,
}: {
  regular: number
  ot: number
  regularLabel: string
  otLabel: string
  unit: string
}) {
  const data = [
    { name: regularLabel, value: regular, color: BLUE },
    { name: otLabel, value: ot, color: AMBER },
  ]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 64 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={80} tick={TICK} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fillOpacity: 0.08 }} formatter={(v: number) => [`${v} ${unit}`]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
          {data.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            fill="currentColor"
            fontSize={12}
            formatter={(v: number) => `${v} ${unit}`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
