"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { hasAnyAlert } from "@/components/transport/gps/GpsAlertBadge"
import { VehicleGpsRow } from "@/components/transport/gps/VehicleGpsRow"
import { VehicleGpsCard } from "@/components/transport/gps/VehicleGpsCard"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const POLL_INTERVAL = 30_000

type Filter = "all" | "alert" | "available" | "busy"

export default function TransportMonitorPage() {
  const [vehicles, setVehicles] = useState<GpsVehicleData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchGps = useCallback(async () => {
    try {
      const res = await fetch("/api/transport/gps")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "ไม่สามารถดึงข้อมูล GPS ได้")
        return
      }
      setVehicles(json.data ?? [])
      setLastFetch(new Date())
      setError(null)
      setCountdown(POLL_INTERVAL / 1000)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ GPS")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGps()
    timerRef.current = setInterval(fetchGps, POLL_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : POLL_INTERVAL / 1000))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchGps])

  const filtered = vehicles.filter((v) => {
    if (filter === "alert" && !hasAnyAlert(v.alerts)) return false
    if (filter === "available" && !v.available) return false
    if (filter === "busy" && v.available) return false
    if (search && !v.plateNumber.toLowerCase().includes(search.toLowerCase()) &&
      !v.driverName.toLowerCase().includes(search.toLowerCase()) &&
      !(v.activeJob?.jobNumber ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: vehicles.length,
    alert: vehicles.filter((v) => hasAnyAlert(v.alerts)).length,
    moving: vehicles.filter((v) => v.speed > 0).length,
    available: vehicles.filter((v) => v.available).length,
    busy: vehicles.filter((v) => !v.available).length,
  }

  const FILTERS: { key: Filter; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: "all", label: "ทั้งหมด", count: stats.total },
    { key: "available", label: "ว่าง", count: stats.available },
    { key: "busy", label: "ไม่ว่าง", count: stats.busy },
    { key: "alert", label: "มี Alert", count: stats.alert, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">มอนิเตอร์รถ</h1>
          <p className="text-sm text-slate-500">
            {lastFetch ? `อัปเดต ${lastFetch.toLocaleTimeString("th-TH")}` : "กำลังโหลด..."}
            {" · "}รีเฟรชอัตโนมัติใน {countdown}s
          </p>
        </div>
        <button
          onClick={() => { fetchGps(); setCountdown(POLL_INTERVAL / 1000) }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="รถทั้งหมด" value={stats.total} color="bg-slate-50 text-slate-700" />
        <StatCard label="ว่าง" value={stats.available} color="bg-emerald-50 text-emerald-700" />
        <StatCard label="ไม่ว่าง" value={stats.busy} color={stats.busy > 0 ? "bg-orange-50 text-orange-700" : "bg-slate-50 text-slate-400"} />
        <StatCard label="กำลังวิ่ง" value={stats.moving} color="bg-blue-50 text-blue-700" />
        <StatCard label="มี Alert" value={stats.alert} color={stats.alert > 0 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400"} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {f.icon}
              {f.label}
              {f.count > 0 && (
                <span className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  f.key === "alert" && f.count > 0 ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="ค้นหาทะเบียน / คนขับ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      {/* Selected vehicle detail card — อยู่เหนือตาราง */}
      {selectedId && (() => {
        const v = vehicles.find((x) => x.id === selectedId)
        if (!v) return null
        return (
          <div className="rounded-xl border border-cyan-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">รายละเอียดรถที่เลือก</span>
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕ ปิด
              </button>
            </div>
            <VehicleGpsCard vehicle={v} />
          </div>
        )
      })()}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-500">{error}</div>
        ) : loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">กำลังโหลดข้อมูล GPS...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">ทะเบียน</th>
                <th className="px-4 py-3 text-left">ความพร้อม</th>
                <th className="px-4 py-3 text-left">GSM</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
                <th className="px-4 py-3 text-left">ความเร็ว</th>
                <th className="px-4 py-3 text-left">ไมล์สะสม</th>
                <th className="px-4 py-3 text-left">แบตเตอรี่</th>
                <th className="px-4 py-3 text-left">ใบงานวันนี้</th>
                <th className="px-4 py-3 text-left">ที่อยู่</th>
                <th className="px-4 py-3 text-left">อัปเดต</th>
                <th className="px-4 py-3 text-left">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">ไม่พบข้อมูล</td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <VehicleGpsRow
                    key={v.id}
                    vehicle={v}
                    selected={v.id === selectedId}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn("rounded-xl border border-white/60 p-3 shadow-sm", color)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-75">{label}</p>
    </div>
  )
}
