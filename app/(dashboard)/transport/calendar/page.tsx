"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { MonthCalendar } from "@/components/transport/calendar/MonthCalendar"
import { GanttTimeline } from "@/components/transport/calendar/GanttTimeline"
import type { CalendarJob } from "@/app/api/transport/calendar/route"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"

type View = "month" | "gantt"

const MONTH_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()  // 0=Sun
  // Start on Sunday
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

type Vehicle = {
  id: string
  plateNumber: string
  name: string
  gpsDeviceId?: string | null
  branchId?: string
}

function TransportCalendarContent() {
  const t = useTranslations("transport")
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>("month")
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [jobs, setJobs] = useState<CalendarJob[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleFilter, setVehicleFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [urlParamsApplied, setUrlParamsApplied] = useState(false)

  useEffect(() => {
    if (urlParamsApplied) return
    const vehicleId = searchParams.get("vehicleId")
    const dateParam = searchParams.get("date")
    if (dateParam === "today") {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      setCurrentDate(d)
      setView("month")
    }
    if (vehicleId) {
      setVehicleFilter(vehicleId)
    }
    setUrlParamsApplied(true)
  }, [searchParams, urlParamsApplied])

  const fetchVehicles = useCallback(async () => {
    setVehiclesError(null)
    try {
      const res = await fetch("/api/transport/vehicles")
      const json = await res.json()
      if (!res.ok) {
        setVehiclesError(typeof json.error === "string" ? json.error : t("loadFailed"))
        return
      }
      const list: Vehicle[] = (json.data ?? []).map(
        (v: {
          id: string
          plateNumber: string
          name: string
          gpsDeviceId?: string | null
          branchId?: string
        }) => ({
          id: v.id,
          plateNumber: v.plateNumber,
          name: v.name,
          gpsDeviceId: v.gpsDeviceId ?? null,
          branchId: v.branchId,
        })
      )
      setVehicles((prev) => {
        const merged = new Map<string, Vehicle>()
        for (const v of [...prev, ...list]) merged.set(v.id, v)
        return [...merged.values()].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
      })
    } catch {
      setVehiclesError(t("loadFailed"))
    }
  }, [t])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  // Compute range based on view
  const { from, to, label } = (() => {
    if (view === "month") {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth()
      const f = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      return {
        from: formatBangkokYmd(f),
        to: formatBangkokYmd(end),
        label: `${MONTH_TH[m]} ${y + 543}`,
      }
    } else {
      const ws = startOfWeek(currentDate)
      const we = addDays(ws, 6)
      const fmtDay = (d: Date) => `${d.getDate()} ${MONTH_TH[d.getMonth()].substring(0, 3)}.`
      return {
        from: formatBangkokYmd(ws),
        to: formatBangkokYmd(we),
        label: `${fmtDay(ws)} – ${fmtDay(we)} ${we.getFullYear() + 543}`,
      }
    }
  })()

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      if (vehicleFilter !== "all") params.set("vehicleId", vehicleFilter)
      const res = await fetch(`/api/transport/calendar?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t("loadFailed")); return }
      setJobs(json.data ?? [])

      setVehicles((prev) => {
        const vMap = new Map<string, Vehicle>()
        for (const v of prev) vMap.set(v.id, v)
        for (const job of (json.data ?? []) as CalendarJob[]) {
          if (job.vehicle) vMap.set(job.vehicle.id, job.vehicle)
        }
        return [...vMap.values()].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
      })
    } catch {
      setError(t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [from, to, vehicleFilter, t])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (view === "month") {
        d.setMonth(d.getMonth() + dir)
        d.setDate(1)
      } else {
        d.setDate(d.getDate() + dir * 7)
      }
      return d
    })
  }

  const goToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setCurrentDate(d)
  }

  const weekStart = startOfWeek(currentDate)

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-2 p-3 md:p-4">
      {/* Title + navigation + toolbar — single compact row */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="shrink-0 text-base font-semibold text-foreground md:text-lg">
            {t("calendarTitle")}
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="truncate text-sm font-semibold text-foreground md:text-base">{label}</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="all" style={{ backgroundColor: "#fff", color: "#0f172a" }}>
              รถทุกคัน
            </option>
            {vehicles.map((v) => (
              <option
                key={v.id}
                value={v.id}
                style={{ backgroundColor: "#fff", color: "#0f172a" }}
              >
                {v.plateNumber} — {v.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              fetchVehicles()
              fetchJobs()
            }}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/60"
            title={t("refresh")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <div className="flex rounded-md border border-border bg-muted p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setView("month")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                view === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              เดือน
            </button>
            <button
              type="button"
              onClick={() => setView("gantt")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                view === "gantt" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Gantt
            </button>
          </div>
        </div>
      </div>

      {vehiclesError && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span>โหลดรายการรถไม่สำเร็จ: {vehiclesError}</span>
          <button
            type="button"
            onClick={fetchVehicles}
            className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-100"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* Summary + priority legend — single compact row */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border bg-card px-2 py-0.5">
          ใบงานทั้งหมด <strong className="text-foreground">{jobs.length}</strong> ใบ
        </span>
        <span className="rounded-full border border-border bg-card px-2 py-0.5">
          มอบหมายแล้ว <strong className="text-foreground">{jobs.filter((j) => j.vehicle).length}</strong> ใบ
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
          รอมอบหมายรถ <strong>{jobs.filter((j) => !j.vehicle).length}</strong> ใบ
        </span>
        <span className="mx-0.5 hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
        {[
          { label: "ด่วนมาก", cls: "bg-red-500 text-white" },
          { label: "สูง", cls: "bg-orange-400 text-white" },
          { label: "ปกติ", cls: "bg-cyan-500 text-white" },
          { label: "ต่ำ", cls: "bg-slate-400 text-white" },
        ].map((p) => (
          <span key={p.label} className={cn("rounded-full px-2 py-0.5 font-medium", p.cls)}>
            {p.label}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600">
            {error}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground shadow-sm">
            {t("calendarLoading")}
          </div>
        ) : view === "month" ? (
          <MonthCalendar
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            jobs={jobs}
          />
        ) : (
          <GanttTimeline
            weekStart={weekStart}
            jobs={jobs}
            vehicles={vehicles}
            onAssigned={fetchJobs}
          />
        )}
      </div>
    </div>
  )
}

export default function TransportCalendarPage() {
  const t = useTranslations("transport")
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">{t("calendarLoading")}</div>}>
      <TransportCalendarContent />
    </Suspense>
  )
}
