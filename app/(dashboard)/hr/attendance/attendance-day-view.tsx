"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Building2, ChevronDown, Clock, FileText, Fingerprint, StickyNote } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { DataPanel } from "@/components/shell/data-panel"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { GlassDialog } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { AttendanceDayPicker } from "./attendance-day-picker"
import { PendingFade } from "@/components/shell/nav-pending"
import { AttendanceSectionTabs } from "./attendance-chrome"
import { isBeforeCompanyEnd } from "@/modules/hr/application/attendance-man-hour"
import { formatDateTime, formatMinutes, formatTime, todayInZone } from "./attendance-format"

type DayRow = {
  id: string
  personnelId: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  badgeNumbers: string[]
  firstIn: string | null
  lastOut: string | null
  scanFirstIn: string | null
  scanLastOut: string | null
  timeConfirmed: boolean
  outConfirmed: boolean
  scanChanged: boolean
  firstInBranchCode: string | null
  lastOutBranchCode: string | null
  punchCount: number
  workedMinutes: number
  manMinutes: number
  lateMinutes: number
  otBefore: OtView | null
  otAfter: OtView | null
  note: string | null
  noteReason: StoredNoteReason | null
  homeBranchId: string
  homeBranchCode: string
  countedBranchId: string
  countedBranchCode: string
  scanBranches: { id: string; code: string }[]
  status: "COMPLETE" | "SINGLE_PUNCH" | "NO_SCAN"
}

type NoteReason = "PERSONAL" | "SICK" | "ABSENT" | "INTRA_DAY"
type StoredNoteReason = NoteReason | "LATE_START" | "LATE" | "OTHER"

const NOTE_REASONS: NoteReason[] = ["PERSONAL", "SICK", "ABSENT", "INTRA_DAY"]

const manageItemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#0f172a] outline-none data-[highlighted]:bg-[#e2e8f0]"

type OtView = {
  at: string
  minutes: number
  status: "PENDING" | "OT" | "NOT_OT"
}

type DayData = {
  branch: { id: string; timezone: string }
  date: string
  lastSyncedAt: string | null
  unmappedBadgesToday: number
  rows: DayRow[]
}

type Punch = { id: string; punchAt: string; badgeNumber: string; deviceName: string; branchCode: string; counted: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function outOriginalAlert(iso: string | null, timeZone: string): boolean {
  if (!iso) return true
  return isBeforeCompanyEnd(new Date(iso), timeZone)
}

function formatDayNote(
  reason: string | null,
  note: string | null,
  label: (key: `day.noteReasons.${NoteReason}`) => string
): string {
  const text = note?.trim() ?? ""
  if (reason && NOTE_REASONS.includes(reason as NoteReason)) {
    const name = label(`day.noteReasons.${reason as NoteReason}`)
    return text ? `${name} — ${text}` : name
  }
  return text || "—"
}

function timeInputValue(iso: string | null, timeZone: string): string {
  if (!iso) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
}

function ScanCell({
  confirmedIso,
  scanIso,
  originalLabel,
  confirmedLabel,
  branchCode,
  timeZone,
  locale,
  alertOriginal = false,
}: {
  confirmedIso: string | null
  scanIso: string | null
  originalLabel: string
  confirmedLabel: string
  branchCode: string | null
  timeZone: string
  locale: string
  alertOriginal?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <TimeBox label={originalLabel} value={scanIso ? formatTime(scanIso, timeZone, locale) : "—"} alert={alertOriginal} />
      {confirmedIso ? (
        <>
          <span className="text-sm font-semibold text-red-600" aria-hidden>
            →
          </span>
          <TimeBox label={confirmedLabel} value={formatTime(confirmedIso, timeZone, locale)} emphasize />
        </>
      ) : null}
      {branchCode ? <span className="text-xs font-medium text-foreground">{branchCode}</span> : null}
    </div>
  )
}

function TimeBox({ label, value, emphasize = false, alert = false }: { label: string; value: string; emphasize?: boolean; alert?: boolean }) {
  const highlighted = emphasize && value !== "—"
  return (
    <div className={cn("min-w-[3.4rem] rounded-md border px-1 py-1 text-center", alert ? "border-red-300 bg-red-100 dark:border-red-500/40 dark:bg-red-950/60" : "border-border bg-background")}>
      <div className="text-[10px] font-medium leading-tight text-foreground">{label}</div>
      <div className={highlighted ? "font-mono text-xs font-semibold text-red-600" : "font-mono text-xs font-semibold text-foreground"}>
        {value}
      </div>
    </div>
  )
}

function OtPair({
  sideLabel,
  item,
  notCountedLabel,
  timeZone,
  locale,
}: {
  sideLabel: string
  item: OtView
  notCountedLabel: string
  timeZone: string
  locale: string
}) {
  const confirmed = item.status === "OT" || item.status === "NOT_OT"
  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-xs text-foreground">
      <span className="font-semibold">{sideLabel}</span>
      <span className="font-mono">{formatTime(item.at, timeZone, locale)}</span>
      {confirmed ? (
        <>
          <span className="font-semibold text-red-600" aria-hidden>
            →
          </span>
          <span className="font-mono font-semibold text-red-600">
            {item.status === "OT" ? formatMinutes(item.minutes) : notCountedLabel}
          </span>
        </>
      ) : null}
    </div>
  )
}

function PunchTimeList({
  detail,
  timeZone,
  locale,
  loadingLabel,
  errorLabel,
  emptyLabel,
}: {
  detail: Punch[] | "loading" | "error" | undefined
  timeZone: string
  locale: string
  loadingLabel: string
  errorLabel: string
  emptyLabel: string
}) {
  if (detail === "loading" || detail === undefined) return <p className="text-sm font-medium text-foreground">{loadingLabel}</p>
  if (detail === "error") return <p className="text-sm font-medium text-red-600">{errorLabel}</p>
  if (detail.length === 0) return <p className="text-sm font-medium text-foreground">{emptyLabel}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {detail.map((punch) => (
        <span
          key={punch.id}
          title={`${punch.deviceName} · ${punch.badgeNumber}`}
          className={
            punch.counted
              ? "rounded border border-border bg-white px-2 py-1 font-mono text-sm font-medium text-foreground"
              : "rounded border border-dashed border-border px-2 py-1 font-mono text-sm text-foreground line-through"
          }
        >
          {formatTime(punch.punchAt, timeZone, locale)} · {punch.branchCode}
        </span>
      ))}
    </div>
  )
}

function OtStatus({ item, pendingLabel, notCountedLabel }: { item: OtView | null; pendingLabel: string; notCountedLabel: string }) {
  if (!item) return <span className="text-foreground">—</span>
  if (item.status === "OT") return <span className="font-mono font-medium text-foreground">{formatMinutes(item.minutes)}</span>
  if (item.status === "NOT_OT") return <span className="text-xs font-medium text-foreground">{notCountedLabel}</span>
  return <span className="text-xs font-medium text-foreground">{pendingLabel}</span>
}

function DayStat({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  const showAlert = alert && value > 0
  return (
    <span
      className={cn(
        "inline-flex min-w-[8.5rem] items-center justify-between gap-3 rounded-lg border px-3 py-1.5",
        showAlert
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50"
          : "border-border bg-background"
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums leading-none",
          showAlert ? "text-amber-800 dark:text-amber-200" : "text-foreground"
        )}
      >
        {value}
      </span>
    </span>
  )
}

function branchChoices(row: DayRow): { id: string; code: string }[] {
  const choices = new Map<string, string>()
  choices.set(row.homeBranchId, row.homeBranchCode)
  for (const branch of row.scanBranches) choices.set(branch.id, branch.code)
  if (!choices.has(row.countedBranchId)) choices.set(row.countedBranchId, row.countedBranchCode)
  return [...choices.entries()].map(([id, code]) => ({ id, code }))
}

function splitHoursMinutes(total: number): { hours: number; minutes: number } {
  const safe = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}

function OtEntry({
  label,
  item,
  timeZone,
  locale,
  canUpdate,
  saving,
  confirmLabel,
  rejectLabel,
  pendingLabel,
  notCountedLabel,
  minutesLabel,
  hoursLabel,
  saveTimeLabel,
  scanAtLabel,
  fromScanLabel,
  onDecide,
}: {
  label: string
  item: OtView
  timeZone: string
  locale: string
  canUpdate: boolean
  saving: boolean
  confirmLabel: string
  rejectLabel: string
  pendingLabel: string
  notCountedLabel: string
  minutesLabel: string
  hoursLabel: string
  saveTimeLabel: string
  scanAtLabel: string
  fromScanLabel: string
  onDecide: (decision: "OT" | "NOT_OT", minutes?: number) => void
}) {
  const initial = splitHoursMinutes(item.minutes)
  const [hoursText, setHoursText] = useState(String(initial.hours))
  const [minutesText, setMinutesText] = useState(String(initial.minutes))
  const [picked, setPicked] = useState<"OT" | "NOT_OT" | null>(null)
  useEffect(() => {
    const next = splitHoursMinutes(item.minutes)
    setHoursText(String(next.hours))
    setMinutesText(String(next.minutes))
    setPicked(null)
  }, [item.at, item.minutes, item.status])
  const hours = Number(hoursText)
  const minutesPart = Number(minutesText)
  const parsed = hours * 60 + minutesPart
  const minutesValid =
    Number.isInteger(hours) &&
    Number.isInteger(minutesPart) &&
    hours >= 0 &&
    hours <= 24 &&
    minutesPart >= 0 &&
    minutesPart <= 59 &&
    parsed >= 1 &&
    parsed <= 24 * 60
  const confirmSelected = picked ? picked === "OT" : item.status === "OT"
  const rejectSelected = picked ? picked === "NOT_OT" : item.status === "NOT_OT"
  const statusLabel = item.status === "OT" ? formatMinutes(item.minutes) : item.status === "NOT_OT" ? notCountedLabel : pendingLabel

  if (!canUpdate) {
    return (
      <div className="text-foreground">
        <span className="mr-1 text-xs font-medium">{label}</span>
        <span className="font-mono">{formatTime(item.at, timeZone, locale)}</span>
        {item.status === "OT" && <span className="ml-2 font-mono">{formatMinutes(item.minutes)}</span>}
        {item.status === "NOT_OT" && <span className="ml-2 text-xs font-medium">{notCountedLabel}</span>}
        {item.status === "PENDING" && <span className="ml-2 text-xs font-medium">{pendingLabel}</span>}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-foreground">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{label}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-300">{statusLabel}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
          <div className="text-xs font-semibold">{scanAtLabel}</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none">{formatTime(item.at, timeZone, locale)}</div>
        </div>
        <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
          <div className="text-xs font-semibold">{fromScanLabel}</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums leading-none">{formatMinutes(item.minutes)}</div>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold">{saveTimeLabel}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums leading-none">
            {minutesValid ? formatMinutes(parsed) : "—"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            {hoursLabel}
            <input
              type="number"
              min={0}
              max={24}
              value={hoursText}
              onChange={(event) => setHoursText(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-lg font-semibold tabular-nums text-foreground focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold">
            {minutesLabel}
            <input
              type="number"
              min={0}
              max={59}
              value={minutesText}
              onChange={(event) => setMinutesText(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-lg font-semibold tabular-nums text-foreground focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={saving || !minutesValid}
          onClick={() => {
            setPicked("OT")
            onDecide("OT", parsed)
          }}
          className={cn(
            "h-11 rounded-lg border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            confirmSelected
              ? "border-blue-700 bg-blue-600 text-white"
              : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
          )}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setPicked("NOT_OT")
            onDecide("NOT_OT")
          }}
          className={cn(
            "h-11 rounded-lg border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            rejectSelected
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-300 bg-white text-foreground hover:bg-slate-100"
          )}
        >
          {rejectLabel}
        </button>
      </div>
    </div>
  )
}

export function AttendanceDayView({
  branchId,
  initialDate,
  canUpdate,
}: {
  branchId: string
  initialDate?: string
  canUpdate: boolean
}) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const [date, setDate] = useState(() => (initialDate && DATE_RE.test(initialDate) ? initialDate : todayInZone("Asia/Bangkok")))
  const [data, setData] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [punches, setPunches] = useState<Record<string, Punch[] | "loading" | "error">>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [otError, setOtError] = useState<{ key: string; message: string } | null>(null)
  const [manageId, setManageId] = useState<string | null>(null)
  const [manageStep, setManageStep] = useState<"ot" | "note" | "punches" | "branch" | "detail" | "time" | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [timeIn, setTimeIn] = useState("")
  const [timeOut, setTimeOut] = useState("")
  const [reasonDraft, setReasonDraft] = useState<NoteReason | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJson<{ data: DayData }>(
        `/api/hr/attendance/days?${new URLSearchParams({ branchId, date })}`
      )
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [branchId, date])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(row: DayRow, side: "BEFORE" | "AFTER", decision: "OT" | "NOT_OT", minutes?: number) {
    const key = `${row.personnelId}:${side}`
    setSavingKey(key)
    setOtError(null)
    try {
      await fetchJson(`/api/hr/attendance/days/ot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          personnelId: row.personnelId,
          date,
          side,
          decision,
          ...(decision === "OT" ? { minutes } : {}),
        }),
      })
      const res = await fetchJson<{ data: DayData }>(
        `/api/hr/attendance/days?${new URLSearchParams({ branchId, date })}`
      )
      setData(res.data)
    } catch (e) {
      setOtError({ key, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setSavingKey(null)
    }
  }

  function openManage(row: DayRow, step: "ot" | "note" | "punches" | "branch" | "detail" | "time") {
    setManageId(row.id)
    setManageStep(step)
    setNoteDraft(row.note ?? "")
    setReasonDraft(NOTE_REASONS.includes(row.noteReason as NoteReason) ? (row.noteReason as NoteReason) : null)
    setTimeIn(timeInputValue(row.firstIn, tz))
    setTimeOut(timeInputValue(row.lastOut, tz))
    setNoteError(null)
    if (step === "punches" || step === "detail") void loadPunches(row)
  }

  async function saveTime(row: DayRow, inTime: string, outTime: string) {
    setSavingNote(true)
    setNoteError(null)
    try {
      await fetchJson(`/api/hr/attendance/days/time`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, personnelId: row.personnelId, date, inTime, outTime }),
      })
      const res = await fetchJson<{ data: DayData }>(`/api/hr/attendance/days?${new URLSearchParams({ branchId, date })}`)
      setData(res.data)
      const next = res.data.rows.find((item) => item.personnelId === row.personnelId)
      setTimeIn(timeInputValue(next?.firstIn ?? null, res.data.branch.timezone))
      setTimeOut(timeInputValue(next?.lastOut ?? null, res.data.branch.timezone))
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNote(false)
    }
  }

  async function saveNote(row: DayRow, reason: NoteReason | null, text: string) {
    setSavingNote(true)
    setNoteError(null)
    try {
      const res = await fetchJson<{ data: { note: string | null; reason: NoteReason | null } }>(
        `/api/hr/attendance/days/note`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId, personnelId: row.personnelId, date, note: text, reason }),
        }
      )
      setNoteDraft(res.data.note ?? "")
      setReasonDraft(res.data.reason)
      setData((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((item) =>
                item.personnelId === row.personnelId
                  ? { ...item, note: res.data.note, noteReason: res.data.reason }
                  : item
              ),
            }
          : current
      )
      setManageStep(null)
      setManageId(null)
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNote(false)
    }
  }

  async function saveBranch(row: DayRow, countedBranchId: string) {
    setSavingNote(true)
    setNoteError(null)
    try {
      await fetchJson(`/api/hr/attendance/days/branch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, personnelId: row.personnelId, date, countedBranchId }),
      })
      const res = await fetchJson<{ data: DayData }>(
        `/api/hr/attendance/days?${new URLSearchParams({ branchId, date })}`
      )
      setData(res.data)
      setManageId(null)
      setManageStep(null)
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingNote(false)
    }
  }

  async function loadPunches(row: DayRow) {
    if (row.status === "NO_SCAN") {
      setPunches((current) => ({ ...current, [row.id]: [] }))
      return
    }
    if (Array.isArray(punches[row.id])) return
    setPunches((current) => ({ ...current, [row.id]: "loading" }))
    try {
      const res = await fetchJson<{ data: Punch[] }>(
        `/api/hr/attendance/days/punches?${new URLSearchParams({ branchId, personnelId: row.personnelId, date })}`
      )
      setPunches((current) => ({ ...current, [row.id]: res.data }))
    } catch {
      setPunches((current) => ({ ...current, [row.id]: "error" }))
    }
  }

  const tz = data?.branch.timezone ?? "Asia/Bangkok"
  const scanned = data?.rows.filter((row) => row.status !== "NO_SCAN") ?? []
  const complete = scanned.filter((row) => row.status === "COMPLETE").length
  const present = scanned.length
  const incomplete = present - complete

  const unmappedOnly = Boolean(data && data.rows.length === 0 && data.unmappedBadgesToday > 0)
  const manageRow = data?.rows.find((row) => row.id === manageId) ?? null
  const mapHref = `/hr/attendance?${new URLSearchParams({ branchId, tab: "badges" })}`

  return (
    <div className="space-y-2">
      <DataPanel padding="sm" className="relative z-20 overflow-visible">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AttendanceSectionTabs branchId={branchId} tab="day" />
          <AttendanceDayPicker branchId={branchId} date={date} today={todayInZone(tz)} onChange={setDate} />
          {data && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <DayStat label={t("day.present")} value={present} />
              <DayStat label={t("day.singlePunchCount")} value={incomplete} alert />
              <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                <span className="font-medium text-foreground">{t("day.lastSynced")}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatDateTime(data.lastSyncedAt, tz, locale)}
                </span>
              </span>
              {data.unmappedBadgesToday > 0 && (
                <Link
                  href={mapHref}
                  className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  {t("day.unmappedWarning", { count: data.unmappedBadgesToday })}
                </Link>
              )}
            </div>
          )}
        </div>
      </DataPanel>

      <PendingFade scope="section">
      <AppDataTablePanel>
        {loading ? (
          <LoadingState title={t("loading")} />
        ) : error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={unmappedOnly ? t("day.emptyUnmappedTitle") : t("day.emptyTitle")}
            description={
              unmappedOnly
                ? t("day.emptyUnmappedDescription", { count: data?.unmappedBadgesToday ?? 0 })
                : t("day.emptyDescription")
            }
            action={
              unmappedOnly ? (
                <Link href={mapHref} className="text-sm font-medium text-amber-800 underline dark:text-amber-200">
                  {t("day.goMap")}
                </Link>
              ) : undefined
            }
          />
        ) : (
            <AppDataTable className="table-fixed">
              <AppDataTableHead dense>
                <tr>
                  <th className="w-[7%] whitespace-nowrap px-2 py-2 font-medium">{t("day.jobGroup")}</th>
                  <th className="w-[11%] px-2 py-2 font-medium">{t("day.person")}</th>
                  <th className="w-[14%] whitespace-nowrap px-2 py-2 font-medium">{t("day.in")}</th>
                  <th className="w-[14%] whitespace-nowrap px-2 py-2 font-medium">{t("day.out")}</th>
                  <th className="w-[8%] whitespace-nowrap px-1 py-2 text-right font-medium">{t("day.late")}</th>
                  <th className="w-[11%] whitespace-nowrap px-2 py-2 font-medium">{t("day.ot")}</th>
                  <th className="w-[7%] whitespace-nowrap px-2 py-2 font-medium">{t("day.status")}</th>
                  <th className="w-[15%] px-2 py-2 font-medium">{t("day.note")}</th>
                  <th className="w-[6%] whitespace-nowrap px-2 py-2 font-medium">{t("day.countedBranchColumn")}</th>
                  <th className="w-[7%] whitespace-nowrap px-2 py-2 font-medium">{t("day.manage")}</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {data.rows.map((row) => {
                  return (
                    <tr key={row.id}>
                        <td className="px-2 py-1.5 text-foreground">{row.jobGroup || "—"}</td>
                        <td className="px-2 py-1.5">
                          <div className="text-foreground">{row.displayName}</div>
                          <div className="font-mono text-xs text-foreground">{row.rosterNo}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <ScanCell
                            confirmedIso={row.timeConfirmed ? row.firstIn : null}
                            scanIso={row.scanFirstIn}
                            originalLabel={t("day.originalTime")}
                            confirmedLabel={t("day.confirmedTime")}
                            branchCode={row.firstInBranchCode}
                            timeZone={tz}
                            locale={locale}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <ScanCell
                            confirmedIso={row.outConfirmed ? row.lastOut : null}
                            scanIso={row.scanLastOut}
                            originalLabel={t("day.originalTime")}
                            confirmedLabel={t("day.confirmedTime")}
                            branchCode={row.lastOutBranchCode}
                            timeZone={tz}
                            locale={locale}
                            alertOriginal={outOriginalAlert(row.scanLastOut, tz)}
                          />
                        </td>
                        <td className="min-w-[4.75rem] px-1 py-1.5 text-right font-mono font-semibold text-foreground">
                          {row.lateMinutes > 0 ? <span className="whitespace-nowrap text-red-600">{t("day.lateMinutes", { count: row.lateMinutes })}</span> : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {!row.otBefore && !row.otAfter ? (
                            <span className="text-foreground">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {row.otBefore && (
                                <OtPair
                                  sideLabel={t("day.otMorning")}
                                  item={row.otBefore}
                                  notCountedLabel={t("day.otNotCounted")}
                                  timeZone={tz}
                                  locale={locale}
                                />
                              )}
                              {row.otAfter && (
                                <OtPair
                                  sideLabel={t("day.otEvening")}
                                  item={row.otAfter}
                                  notCountedLabel={t("day.otNotCounted")}
                                  timeZone={tz}
                                  locale={locale}
                                />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.status === "COMPLETE" ? (
                            <Badge variant="success">{t("status.COMPLETE")}</Badge>
                          ) : row.status === "SINGLE_PUNCH" ? (
                            <Badge variant="warning">{t("status.SINGLE_PUNCH")}</Badge>
                          ) : (
                            <Badge variant="outline">{t("status.NO_SCAN")}</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-sm font-medium text-foreground break-words">
                          {formatDayNote(row.noteReason, row.note, (key) => t(key))}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-foreground">
                          {row.countedBranchId !== row.homeBranchId ? row.countedBranchCode : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0f172a]">
                              {t("day.manage")}
                              <ChevronDown className="h-3.5 w-3.5" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={4}
                                className="z-50 min-w-[11rem] rounded-lg border border-[#cbd5e1] bg-[#ffffff] p-1 shadow-lg"
                              >
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "detail")}>
                                  <FileText className="h-3.5 w-3.5" />
                                  {t("day.manageDetail")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "time")}>
                                  <Clock className="h-3.5 w-3.5" />
                                  {t("day.manageTime")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "ot")}>
                                  <Clock className="h-3.5 w-3.5" />
                                  {t("day.manageOt")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "note")}>
                                  <StickyNote className="h-3.5 w-3.5" />
                                  {t("day.manageNote")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "branch")}>
                                  <Building2 className="h-3.5 w-3.5" />
                                  {t("day.manageBranch")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={manageItemClass} onSelect={() => openManage(row, "punches")}>
                                  <Fingerprint className="h-3.5 w-3.5" />
                                  {t("day.managePunches")}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                    </tr>
                  )
                })}
              </AppDataTableBody>
            </AppDataTable>
        )}
      </AppDataTablePanel>
      </PendingFade>
      <GlassDialog
        solid
        open={manageRow != null && manageStep != null}
        onOpenChange={(open) => {
          if (!open) {
            setManageId(null)
            setManageStep(null)
          }
        }}
        title={
          manageRow
            ? `${
                manageStep === "time"
                  ? t("day.manageTime")
                  : manageStep === "note"
                  ? t("day.manageNote")
                  : manageStep === "punches"
                    ? t("day.managePunches")
                    : manageStep === "branch"
                      ? t("day.manageBranch")
                      : manageStep === "detail"
                        ? t("day.manageDetail")
                        : t("day.manageOt")
              } — ${manageRow.displayName}`
            : t("day.manage")
        }
      >
        {manageRow && manageStep === "detail" && (
          <div className="space-y-4 text-foreground">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs font-semibold">{t("day.jobGroup")}</dt>
                <dd className="mt-0.5 text-sm font-medium">{manageRow.jobGroup || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.person")}</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {manageRow.displayName}
                  <span className="ml-2 font-mono text-xs">{manageRow.rosterNo}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.status")}</dt>
                <dd className="mt-0.5 text-sm font-medium">{t(`status.${manageRow.status}`)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.hours")}</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold">
                  {manageRow.status === "COMPLETE" ? formatMinutes(manageRow.manMinutes) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.in")}</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {manageRow.firstIn ? (
                    <>
                      <span className="font-mono">{formatTime(manageRow.firstIn, tz, locale)}</span>
                      {manageRow.firstInBranchCode ? <span className="ml-2 text-xs">{manageRow.firstInBranchCode}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.out")}</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {manageRow.lastOut ? (
                    <>
                      <span className="font-mono">{formatTime(manageRow.lastOut, tz, locale)}</span>
                      {manageRow.lastOutBranchCode ? <span className="ml-2 text-xs">{manageRow.lastOutBranchCode}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.late")}</dt>
                <dd className={cn("mt-0.5 font-mono text-sm font-semibold", manageRow.lateMinutes > 0 && "text-red-600")}>
                  {manageRow.lateMinutes > 0 ? t("day.lateMinutes", { count: manageRow.lateMinutes }) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.punches")}</dt>
                <dd className="mt-0.5 text-sm font-medium">{manageRow.punchCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.branchHome")}</dt>
                <dd className="mt-0.5 text-sm font-medium">{manageRow.homeBranchCode}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">{t("day.countedBranchColumn")}</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {manageRow.countedBranchId !== manageRow.homeBranchId ? manageRow.countedBranchCode : t("day.branchHome")}
                </dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: t("day.otMorning"), item: manageRow.otBefore },
                { title: t("day.otEvening"), item: manageRow.otAfter },
              ].map((part) => (
                <div key={part.title} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold">{part.title}</div>
                  {part.item ? (
                    <div className="mt-1 space-y-0.5 text-sm font-medium">
                      <div className="font-mono">{formatTime(part.item.at, tz, locale)}</div>
                      <div className="font-mono">{formatMinutes(part.item.minutes)}</div>
                      <div>
                        <OtStatus item={part.item} pendingLabel={t("day.otPending")} notCountedLabel={t("day.otNotCounted")} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm font-medium">—</div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold">{t("day.managePunches")}</div>
              <div className="mt-2">
                <PunchTimeList
                  detail={punches[manageRow.id]}
                  timeZone={tz}
                  locale={locale}
                  loadingLabel={t("loading")}
                  errorLabel={t("day.punchesError")}
                  emptyLabel={t("day.noPunches")}
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold">{t("day.note")}</div>
              <p className="mt-1 text-sm font-medium">
                {formatDayNote(manageRow.noteReason, manageRow.note, (key) => t(key))}
              </p>
            </div>
          </div>
        )}
        {manageRow && manageStep === "ot" && (
          <div className="space-y-3 text-foreground">
            {!manageRow.otBefore && !manageRow.otAfter ? (
              <p className="text-sm">{t("day.noOt")}</p>
            ) : (
              <div className="space-y-2">
                {manageRow.otBefore && (
                  <OtEntry
                    label={t("day.otBeforeTitle")}
                    item={manageRow.otBefore}
                    timeZone={tz}
                    locale={locale}
                    canUpdate={canUpdate}
                    saving={savingKey === `${manageRow.personnelId}:BEFORE`}
                    confirmLabel={t("day.otConfirm")}
                    rejectLabel={t("day.otReject")}
                    pendingLabel={t("day.otPending")}
                    notCountedLabel={t("day.otNotCounted")}
                    minutesLabel={t("day.otMinutes")}
                                  hoursLabel={t("day.otHours")}
                                  saveTimeLabel={t("day.otToSave")}
                    scanAtLabel={t("day.otScanAt")}
                    fromScanLabel={t("day.otFromScan")}
                    onDecide={(decision, minutes) => void decide(manageRow, "BEFORE", decision, minutes)}
                  />
                )}
                {manageRow.otAfter && (
                  <OtEntry
                    label={t("day.otAfterTitle")}
                    item={manageRow.otAfter}
                    timeZone={tz}
                    locale={locale}
                    canUpdate={canUpdate}
                    saving={savingKey === `${manageRow.personnelId}:AFTER`}
                    confirmLabel={t("day.otConfirm")}
                    rejectLabel={t("day.otReject")}
                    pendingLabel={t("day.otPending")}
                    notCountedLabel={t("day.otNotCounted")}
                    minutesLabel={t("day.otMinutes")}
                                  hoursLabel={t("day.otHours")}
                                  saveTimeLabel={t("day.otToSave")}
                    scanAtLabel={t("day.otScanAt")}
                    fromScanLabel={t("day.otFromScan")}
                    onDecide={(decision, minutes) => void decide(manageRow, "AFTER", decision, minutes)}
                  />
                )}
                {otError?.key.startsWith(`${manageRow.personnelId}:`) && (
                  <p className="text-xs text-red-600">{otError.message}</p>
                )}
              </div>
            )}
          </div>
        )}
        {manageRow && manageStep === "branch" && (
          <div className="space-y-2 text-foreground">
            {branchChoices(manageRow).map((choice) => {
              const selected = choice.id === manageRow.countedBranchId
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={!canUpdate || savingNote}
                  onClick={() => void saveBranch(manageRow, choice.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
                    selected
                      ? "border-blue-700 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-foreground hover:bg-slate-100"
                  )}
                >
                  <span>
                    {choice.code}
                    {choice.id === manageRow.homeBranchId ? ` · ${t("day.branchHome")}` : ""}
                  </span>
                  {selected ? <span className="text-xs">{t("day.branchCounted")}</span> : null}
                </button>
              )
            })}
            {noteError && <p className="text-xs text-red-600">{noteError}</p>}
          </div>
        )}
        {manageRow && manageStep === "punches" && (
          <div className="space-y-2 text-foreground">
            <PunchTimeList
              detail={punches[manageRow.id]}
              timeZone={tz}
              locale={locale}
              loadingLabel={t("loading")}
              errorLabel={t("day.punchesError")}
              emptyLabel={t("day.noPunches")}
            />
          </div>
        )}
        {manageRow && manageStep === "time" && (
          <div className="space-y-3 text-foreground">
            <p className="text-sm">
              {t("day.timeScan")}:{" "}
              <span className="font-mono">
                {manageRow.scanFirstIn ? formatTime(manageRow.scanFirstIn, tz, locale) : "—"} /{" "}
                {manageRow.scanLastOut ? formatTime(manageRow.scanLastOut, tz, locale) : "—"}
              </span>
            </p>
            {!manageRow.scanFirstIn && <p className="text-sm">{t("day.timeNoScan")}</p>}
            {manageRow.scanChanged && <p className="text-sm font-medium text-red-600">{t("day.scanChanged")}</p>}
            <label className="block text-sm font-medium" htmlFor="confirm-time-in">
              {t("day.timeIn")}
              <input
                id="confirm-time-in"
                type="time"
                value={timeIn}
                disabled={!canUpdate}
                onChange={(event) => setTimeIn(event.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="confirm-time-out">
              {t("day.timeOut")}
              <span className="ml-1 font-normal text-muted-foreground">{t("day.timeOutOptional")}</span>
              <input
                id="confirm-time-out"
                type="time"
                value={timeOut}
                disabled={!canUpdate}
                onChange={(event) => setTimeOut(event.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
            </label>
            {noteError && <p className="text-xs text-red-600">{noteError}</p>}
            {canUpdate && (
              <div className="flex gap-2">
                <Button type="button" size="sm" loading={savingNote} onClick={() => void saveTime(manageRow, timeIn, timeOut)}>
                  {t("day.saveTime")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={savingNote} onClick={() => void saveTime(manageRow, "", "")}>
                  {t("day.clearTime")}
                </Button>
              </div>
            )}
          </div>
        )}
        {manageRow && manageStep === "note" && (
          <div className="space-y-3 text-foreground">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("day.noteReasonOptional")}</p>
              {NOTE_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="attendance-note-reason"
                    checked={reasonDraft === reason}
                    disabled={!canUpdate}
                    onChange={() => setReasonDraft(reason)}
                    onClick={(event) => {
                      if (reasonDraft !== reason) return
                      event.preventDefault()
                      setReasonDraft(null)
                    }}
                  />
                  {t(`day.noteReasons.${reason}`)}
                </label>
              ))}
            </div>
            <textarea
              id="attendance-day-note"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              readOnly={!canUpdate}
              maxLength={500}
              rows={3}
              placeholder={t("day.notePlaceholder")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {noteError && <p className="text-xs text-red-600">{noteError}</p>}
            {canUpdate && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" loading={savingNote} onClick={() => void saveNote(manageRow, reasonDraft, noteDraft)}>
                  {t("day.saveNote")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingNote}
                  onClick={() => void saveNote(manageRow, null, "")}
                >
                  {t("day.clearNote")}
                </Button>
              </div>
            )}
          </div>
        )}
      </GlassDialog>
    </div>
  )
}
