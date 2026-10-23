import { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { getPMCompliance, type PmItemState } from "@/modules/maintenance/application/pm-compliance"
import { WORK_ORDER_STATUS_LABEL, type WorkOrderStatusName } from "@/modules/work_orders/application/work-order-transitions"
import { GeneratePmButton } from "./generate-pm-button"

export const metadata: Metadata = { title: "ปฏิทินซ่อมบำรุง" }

const STATES: PmItemState[] = ["on_time", "late", "open", "due_today", "upcoming", "excluded"]

const stateChip: Record<PmItemState, string> = {
  on_time: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-200 dark:border-green-800",
  late: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800",
  open: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800",
  due_today: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
  upcoming: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800",
  excluded: "bg-muted text-muted-foreground border-border",
}

const stateBadge: Record<PmItemState, "success" | "warning" | "danger" | "info" | "default"> = {
  on_time: "success",
  late: "warning",
  open: "danger",
  due_today: "warning",
  upcoming: "info",
  excluded: "default",
}

function isState(value: string | undefined): value is PmItemState {
  return !!value && (STATES as string[]).includes(value)
}

export default async function MaintenanceCalendarPage(props: {
  searchParams: Promise<{ year?: string; month?: string; filter?: string }>
}) {
  const searchParams = await props.searchParams
  const t = await getTranslations("maintenancePm")
  const session = await auth()
  const companyId = session!.user.companyId as string
  const roles = session!.user.roles as UserRole[]

  const now = new Date()
  const parsedYear = parseInt(searchParams.year ?? "", 10)
  const parsedMonth = parseInt(searchParams.month ?? "", 10)
  const year = Number.isFinite(parsedYear) && parsedYear > 2000 && parsedYear < 2200 ? parsedYear : now.getFullYear()
  const month = Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1
  const filter = isState(searchParams.filter) ? searchParams.filter : null

  const compliance = await getPMCompliance(prisma, {
    companyId,
    roles,
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  })
  const canGenerate =
    isAdminInAnyBranch(roles) || getBranchIds(roles).some((id) => hasPermission(roles, id, "schedules", "create"))

  const itemsByDay: Record<number, typeof compliance.items> = {}
  for (const item of compliance.items) {
    const day = item.dueDate.getUTCDate()
    ;(itemsByDay[day] ??= []).push(item)
  }
  const listed = filter ? compliance.items.filter((item) => item.state === filter) : compliance.items

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthQuery = `year=${year}&month=${month}`
  const prevMonth = month === 1 ? `?year=${year - 1}&month=12` : `?year=${year}&month=${month - 1}`
  const nextMonth = month === 12 ? `?year=${year + 1}&month=1` : `?year=${year}&month=${month + 1}`
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (day: number) =>
    now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day

  const stats: { key: PmItemState | null; label: string; value: string; hint?: string }[] = [
    {
      key: null,
      label: t("complianceRate"),
      value: compliance.rate === null ? "—" : `${compliance.rate}%`,
      hint: t("complianceOf", { onTime: compliance.onTime, due: compliance.due }),
    },
    { key: "on_time", label: t("state_on_time"), value: String(compliance.onTime) },
    { key: "late", label: t("state_late"), value: String(compliance.late) },
    { key: "open", label: t("state_open"), value: String(compliance.open) },
    { key: "due_today", label: t("state_due_today"), value: String(compliance.dueToday) },
    { key: "upcoming", label: t("state_upcoming"), value: String(compliance.upcoming) },
    {
      key: "excluded",
      label: t("state_excluded"),
      value: String(compliance.excluded.total),
      hint:
        compliance.excluded.total > 0
          ? t("excludedBreakdown", {
              cancelled: compliance.excluded.cancelled,
              skipped: compliance.excluded.skipped,
              deleted: compliance.excluded.machine_deleted,
              assetInactive: compliance.excluded.asset_inactive,
            })
          : undefined,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("calendarTitle")}
        description={t("calendarDescription", { count: compliance.items.length })}
        actions={canGenerate ? <GeneratePmButton /> : undefined}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((stat) => {
          const active = stat.key !== null && filter === stat.key
          const href = stat.key && !active ? `?${monthQuery}&filter=${stat.key}#due-list` : `?${monthQuery}#due-list`
          return (
            <Link
              key={stat.label}
              href={href}
              aria-current={active ? "true" : undefined}
              className={`rounded-xl border px-3 py-2 transition-colors hover:bg-muted/60 ${
                active ? "border-blue-500 ring-1 ring-blue-500" : "border-border"
              } bg-card`}
            >
              <p className="text-xs text-foreground">{stat.label}</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{stat.value}</p>
              {stat.hint && <p className="text-[11px] text-muted-foreground">{stat.hint}</p>}
            </Link>
          )
        })}
      </div>
      <p className="text-xs text-foreground">{t("complianceRule")}</p>

      <DataPanel>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <Link href={`/maintenance/calendar${prevMonth}`} aria-label={t("prevMonth")} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h2 className="text-base font-semibold text-foreground">{monthName}</h2>
          <Link href={`/maintenance/calendar${nextMonth}`} aria-label={t("nextMonth")} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </Link>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-semibold ${i === 0 ? "text-red-600 dark:text-red-400" : i === 6 ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-[92px] border-b border-r border-border p-1.5 ${!day ? "bg-muted/50" : ""} ${idx % 7 === 6 ? "border-r-0" : ""}`}
            >
              {day && (
                <>
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full mb-1 ${
                      isToday(day) ? "bg-blue-600 text-white" : "text-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {(itemsByDay[day] ?? []).slice(0, 3).map((item) => (
                      <Link
                        key={item.scheduleId}
                        href={item.workOrder ? `/work-orders/${item.workOrder.id}` : `/maintenance/plans/${item.plan.id}`}
                        title={`${item.target.name} — ${item.plan.name} · ${t(`state_${item.state}`)}`}
                        className={`block px-1.5 py-0.5 rounded text-[10px] font-medium border truncate hover:opacity-80 transition-opacity ${stateChip[item.state]}`}
                      >
                        {item.target.code}: {item.plan.typeCode}
                      </Link>
                    ))}
                    {(itemsByDay[day]?.length ?? 0) > 3 && (
                      <p className="text-[10px] text-foreground px-1">{t("moreItems", { count: itemsByDay[day].length - 3 })}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-5 py-3 flex-wrap">
          {STATES.map((state) => (
            <div key={state} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded border ${stateChip[state]}`} />
              <span className="text-xs text-foreground">{t(`state_${state}`)}</span>
            </div>
          ))}
        </div>
      </DataPanel>

      <section id="due-list" className="space-y-2 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("dueListTitle")}
            {filter ? ` · ${t(`state_${filter}`)}` : ""}
          </h2>
          {filter && (
            <Link href={`?${monthQuery}#due-list`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              {t("clearFilter")}
            </Link>
          )}
        </div>
        <DataPanel className="[&_td]:text-foreground [&_th]:text-foreground">
          {listed.length === 0 ? (
            <EmptyState icon={CalendarClock} title={t("dueListEmpty")} description={t("dueListEmptyHint")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-4 py-2 font-semibold">{t("dueDate")}</th>
                    <th className="px-4 py-2 font-semibold">{t("machine")}</th>
                    <th className="px-4 py-2 font-semibold">{t("plan")}</th>
                    <th className="px-4 py-2 font-semibold">{t("workOrder")}</th>
                    <th className="px-4 py-2 font-semibold">{t("pmState")}</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((item) => (
                    <tr key={item.scheduleId}>
                      <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                        {item.dueDate.toLocaleDateString("th-TH", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={item.target.href} className="hover:underline">
                          <span className="font-mono">{item.target.code}</span> {item.target.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{item.branchName}</span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/maintenance/plans/${item.plan.id}`} className="hover:underline">
                          {item.plan.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {item.workOrder ? (
                          <Link href={`/work-orders/${item.workOrder.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                            {item.workOrder.woNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t("noWorkOrderYet")}</span>
                        )}
                        {item.workOrder && (
                          <span className="block text-xs text-muted-foreground">
                            {WORK_ORDER_STATUS_LABEL[item.workOrder.status as WorkOrderStatusName] ?? item.workOrder.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={stateBadge[item.state]}>{t(`state_${item.state}`)}</Badge>
                        {item.excludeReason && (
                          <span className="block text-xs text-muted-foreground mt-0.5">{t(`exclude_${item.excludeReason}`)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>
      </section>
    </div>
  )
}
