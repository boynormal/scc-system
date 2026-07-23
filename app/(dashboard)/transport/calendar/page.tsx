"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { MonthCalendar } from "@/components/transport/calendar/MonthCalendar"
import { GanttTimeline } from "@/components/transport/calendar/GanttTimeline"
import type { CalendarJob } from "@/app/api/transport/calendar/route"

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

function toDateStr(d: Date) {
  return d.toISOString().substring(0, 10)
}

type Vehicle = {
  id: string
  plateNumber: string
  name: string
  gpsDeviceId?: string | null
  branchId?: string
}

function TransportCalendarContent() {
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

  useEffect(() => {
    fetch("/api/transport/vehicles")
      .then((r) => r.json())
      .then((json) => {
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
      })
      .catch(() => {})
  }, [])

  // Compute range based on view
  const { from, to, label } = (() => {
    if (view === "month") {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth()
      const f = new Date(y, m, 1)
      const t = new Date(y, m + 1, 0)
      return {
        from: toDateStr(f),
        to: toDateStr(t),
        label: `${MONTH_TH[m]} ${y + 543}`,
      }
    } else {
      const ws = startOfWeek(currentDate)
      const we = addDays(ws, 6)
      const fmtDay = (d: Date) => `${d.getDate()} ${MONTH_TH[d.getMonth()].substring(0, 3)}.`
      return {
        from: toDateStr(ws),
        to: toDateStr(we),
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
      if (!res.ok) { setError(json.error ?? "โหลดข้อมูลไม่ได้"); return }
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
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    } finally {
      setLoading(false)
    }
  }, [from, to, vehicleFilter])

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
    <div className="space-y-4 p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            วันนี้
          </button>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-slate-900">{label}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Vehicle filter */}
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="all">รถทุกคัน</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchJobs}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="รีเฟรช"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1">
            <button
              onClick={() => setView("month")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              เดือน
            </button>
            <button
              onClick={() => setView("gantt")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "gantt" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Gantt
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          ใบงานทั้งหมด <strong className="text-slate-800">{jobs.length}</strong> ใบ
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          มอบหมายแล้ว <strong className="text-slate-800">{jobs.filter((j) => j.vehicle).length}</strong> ใบ
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
          รอมอบหมายรถ <strong>{jobs.filter((j) => !j.vehicle).length}</strong> ใบ
        </span>
      </div>

      {/* Priority legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { label: "ด่วนมาก", cls: "bg-red-500 text-white" },
          { label: "สูง", cls: "bg-orange-400 text-white" },
          { label: "ปกติ", cls: "bg-cyan-500 text-white" },
          { label: "ต่ำ", cls: "bg-slate-400 text-white" },
        ].map((p) => (
          <span key={p.label} className={cn("rounded-full px-3 py-0.5 font-medium", p.cls)}>
            {p.label}
          </span>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400 shadow-sm">
          กำลังโหลดข้อมูลปฏิทิน...
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
  )
}

export default function TransportCalendarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">กำลังโหลดปฏิทิน...</div>}>
      <TransportCalendarContent />
    </Suspense>
  )
}
